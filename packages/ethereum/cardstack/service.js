const Ember = require('ember-source/dist/ember.debug');
const { dasherize, camelize, capitalize } = Ember.String;
const { pluralize, singularize } = require('inflection');
const Web3 = require('web3');
const log = require('@cardstack/logger')('cardstack/ethereum/service');
const { declareInjections } = require('@cardstack/di');
const { uniqWith, isEqual, get } = require('lodash');
const { promisify } = require('util');
const timeout = promisify(setTimeout);

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
const MAX_WS_MESSAGE_SIZE_BYTES = 20000000;

module.exports = declareInjections({
  indexer: 'hub:indexers'
},

class EthereumService {

  static create(...args) {
    return new this(...args);
  }

  constructor({ indexer }) {
    this._indexer = indexer;
    this._providers = {};
    this._eventListeners = {};
    this._hasStartedListening = {};
    this._hasConnected = false;
    this._isIndexing = {};
    this._indexQueue = {};
    this._processQueueTimeoutMs = 1000;
    this._processQueueTimeout = {};
    this._contractDefinitions = {};
    this._branches = null;
    this._eventDefinitions = {};
    this._contracts = {};
    this._indexerPromise = null; // exposing this for the tests
  }

  connect(branches) {
    if (this._hasConnected) { return; }

    this._hasConnected = true;
    this._branches = branches;
    for (let branch of Object.keys(branches)) {
      let { jsonRpcUrl } = branches[branch];
      log.info(`connecting to ethereum JSON RPC provider at: ${jsonRpcUrl} for branch "${branch}"`);
      this._providers[branch] = new Web3(new Web3.providers.WebsocketProvider(jsonRpcUrl));

      // The default WS message size is too small to handle much activity, and sadly the WS configuration
      // is not exposed from web3, so we need to reach a bit deep into the web3 WS provider to adjust the
      // websocket client config.
      let websocketConfig = get(this, `_providers.${branch}.currentProvider.connection._client.config`);
      if (websocketConfig) {
         websocketConfig.maxReceivedFrameSize = MAX_WS_MESSAGE_SIZE_BYTES;
         websocketConfig.maxReceivedMessageSize = MAX_WS_MESSAGE_SIZE_BYTES;
      }
    }
  }

  async _reconnect() {
    log.info("start reconnecting ethereum service...");

    let done;
    this._reconnectPromise = new Promise(r => done = r);

    await this.stopAll();
    await timeout(10 * 1000); // cool down period before we start issuing requests again

    this._hasConnected = false;
    this._contracts = new WeakMap();
    this._providers = new WeakMap();
    this._eventListeners = new WeakMap();
    this._eventDefinitions = new WeakMap();

    this.connect(this._branches);
    await this.start(this._contractDefinitions);

    log.info("completed reconnecting to ethereum service");
    done();
  }

  async stopAll() {
    for (let name of Object.keys(this._eventListeners)) {
      await this.stop(name);
    }
  }
  async stop(name) {
    log.info("stopping event listening for contract " + name);

    await this._indexerPromise;
    if (!this._eventListeners[name]) { return; }

    for (let branch of Object.keys(this._eventListeners[name])) {
      this._eventListeners[name][branch].unsubscribe();
    }

    clearTimeout(this._processQueueTimeout[name]);
    this._eventListeners[name] = {};
    this._hasStartedListening[name] = false;
  }

  async getBlockHeight(branch) {
    return await this._providers[branch].eth.getBlockNumber();
  }

  async start({ name, contract }) {
    if (this._hasStartedListening[name]) { return; }

    await this.stop(name);
    this._hasStartedListening[name] = true;
    this._contractDefinitions[name] = contract;

    let { abi, addresses } = contract;
    this._eventDefinitions[name] = getEventDefinitions(name, contract);

    if (!this._eventListeners[name]) {
      this._eventListeners[name] = {};
    }
    for (let branch of Object.keys(addresses)) {
      if (!this._providers[branch]) { continue; }

      log.info(`starting listeners for contract ${name} at ${addresses[branch]}`);

      let aContract = new this._providers[branch].eth.Contract(abi, addresses[branch]);
      if (!this._contracts[branch]) {
        this._contracts[branch] = {};
      }
      this._contracts[branch][name] = aContract;

      this._eventListeners[name][branch] = aContract.events.allEvents(async (error, event) => {
        if (error) {
          log.error(`error received listening for events from contract ${name}: ${error.reason}`);
          if (error.type === 'close') {
            await this._reconnect();
          }
        } else {
          log.trace(`contract event received for ${name}: ${JSON.stringify(event, null, 2)}`);
          let hints = this._generateHintsFromEvent({ branch, contract: name, event });
          log.debug("addings hints to queue", JSON.stringify(hints, null, 2));

          this._indexQueue[name] = (this._indexQueue[name] || []).concat(hints);
        }
      });
    }

    this._processQueue(name);
  }

  async getContractInfo({ branch, contract, type }) {
    if (!contract && type) {
      log.debug(`getting all top level contract info for contract type: ${type}, branch: ${branch}`);
      if (this._contractDefinitions[singularize(type)]) {
        contract = singularize(type);
      } else {
        contract = type;
      }
    }

    log.debug(`getting all top level contract info for contract: ${contract}, branch: ${branch}`);
    let contractDefinition = this._contractDefinitions[contract];
    if (!contractDefinition) { throw new Error(`cannot find contract with branch: ${branch}, contract name: ${contract}`); }

    let aContract = this._contracts[branch][contract];
    if (!aContract) {
      log.warn(`a contract instance is not yet available for contract: ${contract}, branch: ${branch}`);
      return;
    }

    await this._reconnectPromise;

    let address = contractDefinition.addresses[branch];
    let attributes = {
      'ethereum-address': address,
      'balance-wei': await this._providers[branch].eth.getBalance(address)
    };

    let methods = contractDefinition.abi.filter(item => item.type === 'function' &&
                                                        item.constant &&
                                                        !item.inputs.length)
                                        .map(item => item.name);
    for (let method of methods) {
      attributes[`${contract}-${dasherize(method)}`] = await aContract.methods[method]().call();
    }

    let model = { id: address, type: pluralize(contract), attributes };

    log.trace(`retrieved contract model for contract ${contract}, branch ${branch}, address ${address}: ${JSON.stringify(model, null, 2)}`);
    return model;
  }

  async getContractInfoFromHint({ id, branch, type, contractName}) {
    log.debug(`getting contract data for id: ${id}, type: ${type}, branch: ${branch}`);
    if (!branch || !type || !id) { return; }

    await this._reconnectPromise;

    let contractNameRegex = new RegExp(`^${contractName}-`);
    let dasherizedMethod = type.replace(contractNameRegex, '');
    let method = camelize(dasherizedMethod);

    if (!this._contracts[branch] || !this._contracts[branch][contractName]) {
      throw new Error(`cannot find contract with branch: ${branch}, type: ${type}`);
    }

    let aContract = this._contracts[branch][contractName];
    let methodName;
    if (typeof aContract.methods[method] === 'function') {
      methodName = method;
    } else if (typeof aContract.methods[singularize(method)] === 'function') {
      methodName = singularize(method);
    } else if (typeof aContract.methods[capitalize(method)] === 'function') {
      methodName = capitalize(method);
    } else if (typeof aContract.methods[singularize(capitalize(method))] === 'function') {
      methodName = singularize(capitalize(method));
    }

    let data = await aContract.methods[methodName](id).call();
    log.debug(`retrieved contract data for contract ${contractName}.${methodName}(${id || ''}): ${data}`);
    return { data, methodName };
  }

  async getPastEventsAsHints(blockHeights) {
    log.debug(`getting past events as hints for contracts ${blockHeights ? JSON.stringify(blockHeights) : ''}`);
    let hints = [];
    let currentBlockHeights = {};

    await this._reconnectPromise;
    for (let branch of Object.keys(this._contracts)) {
      currentBlockHeights[branch] = await this.getBlockHeight(branch);
      for (let contract of Object.keys(this._contracts[branch])) {
        let aContract = this._contracts[branch][contract];
        let contractHints = [];

        for (let event of Object.keys(this._contractDefinitions[contract].eventContentTriggers || [])) {
          let rawHints = [], events = [];
          let lastIndexedBlockHeight = get(blockHeights, branch);
          try {
            // TODO we might need to chunk this so we don't blow past the websocket max frame size in the web3 provider: https://github.com/ethereum/web3.js/issues/1297
            events = await aContract.getPastEvents(event, { fromBlock: lastIndexedBlockHeight ? lastIndexedBlockHeight + 1 : 0, toBlock: 'latest' });
          } catch (err) {
            // for some reason web3 on the private blockchain throws an error when it cannot find any of the requested events
            log.info(`could not find any past contract events of contract ${contract} for event ${event}. ${err.message}`);
          }
          log.trace(`discovered ${event} events for contract ${contract}: ${JSON.stringify(events, null, 2)}`);

          for (let rawEvent of events) {
            rawHints = rawHints.concat(this._generateHintsFromEvent({ branch, contract, event: rawEvent }));
          }
          contractHints = contractHints.concat(uniqWith(rawHints, isEqual));
        }
        hints = hints.concat(uniqWith(contractHints, isEqual));
      }
    }
    log.debug(`discovered contract events resulting in hints: ${JSON.stringify(hints, null, 2)}`);
    return { hints, blockHeights: currentBlockHeights };
  }

  _setProcessQueueTimeout(name, timeout) {
    clearTimeout(this._processQueueTimeout[name]);

    this._processQueueTimeoutMs = timeout;
    this._processQueue(name);
  }

   // the web3 event handler assumes synchronous event callback functions,
   // so we're dealing with the async nature of our event callbacks in this
   // queue processor.
  _processQueue(name) {
    let scheduleNextProcess = contractName => setTimeout(() => this._processQueue(contractName), this._processQueueTimeoutMs);

    if (!this._indexQueue[name] ||
         this._indexQueue[name].length && !this._isIndexing[name]) {
      this._isIndexing[name] = true;
      let queue = this._indexQueue[name];
      this._indexQueue[name] = [];
      let hints = uniqWith(queue, isEqual);

      log.debug("processing index queue ", hints);
      this._indexerPromise = this._indexer.update({ forceRefresh: true, hints });

      Promise.resolve(this._indexerPromise)
        .then(() => this._processQueueTimeout[name] = scheduleNextProcess(name))
        .catch(err => log.error(`error encountered processing indexer queue for contract ${name}: ${err.message}`, err.stackTrace))
        .then(() => this._isIndexing[name] = false); // no finally yet :-( https://stackoverflow.com/questions/35999072/what-is-the-equivalent-of-bluebird-promise-finally-in-native-es6-promises
    } else {
      this._processQueueTimeout[name] = scheduleNextProcess(name);
    }
  }

  _generateHintsFromEvent({ branch, contract, event }) {
    let contractHint = { branch, type: pluralize(contract), id: this._contractDefinitions[contract].addresses[branch], isContractType: true };
    let addressParams = this._eventDefinitions[contract][event.event].inputs.filter(input => input.type === 'address');
    let addresses = addressParams.map(param => event.returnValues[param.name]).filter(address => address !== NULL_ADDRESS);
    let contentTypes = this._contractDefinitions[contract].eventContentTriggers ? this._contractDefinitions[contract].eventContentTriggers[event.event] : null;

    let hints = [ contractHint ];
    if (!contentTypes || !contentTypes.length ) {
      return hints;
    }

    for (let type of contentTypes) {
      for (let id of addresses) {
        hints.push({ branch, type, id, contract });
      }
    }

    return hints;
  }

});

function  getEventDefinitions(contractName, { abi }) {
  let events = {};

  for (let event of abi.filter(item => item.type === 'event')) {
    events[event.name] = event;
  }
  return events;
}
