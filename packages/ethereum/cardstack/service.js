const Ember = require('ember-source/dist/ember.debug');
const { dasherize, camelize, capitalize } = Ember.String;
const { pluralize, singularize } = require('inflection');
const Web3 = require('web3');
const log = require('@cardstack/logger')('cardstack/ethereum/service');
const { uniqWith, isEqual, get } = require('lodash');
const { promisify } = require('util');
const timeout = promisify(setTimeout);

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
const MAX_WS_MESSAGE_SIZE_BYTES = 20000000;

module.exports = class EthereumService {

  static create(...args) {
    return new this(...args);
  }

  constructor() {
    this._providers = {};
    this._eventListeners = {};
    this._hasStartedListening = {};
    this._hasConnected = false;
    this._contractDefinitions = {};
    this._branches = null;
    this._eventDefinitions = {};
    this._contracts = {};
    this._pastContracts = {};
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
    this._contracts = {};
    this._pastContracts = {};
    this._providers = {};
    this._eventListeners = {};
    this._eventDefinitions = {};

    this.connect(this._branches);

    for (let name of Object.keys(this._contractDefinitions)) {
      await this.start({
        name,
        contract: this._contractDefinitions[name],
      });
    }

    log.info("finished trying to reconnect to ethereum service");
    done();
  }

  async stopAll() {
    for (let name of Object.keys(this._eventListeners)) {
      await this.stop(name);
    }
  }
  async stop(name) {
    log.info("stopping event listening for contract " + name);

    if (!this._eventListeners[name]) { return; }

    for (let branch of Object.keys(this._eventListeners[name])) {
      this._eventListeners[name][branch].unsubscribe();
    }

    this._eventListeners[name] = {};
    this._hasStartedListening[name] = false;
  }

  async getBlockHeight(branch) {
    await this._reconnectPromise;

    let result;
    try {
      result = await this._providers[branch].eth.getBlockNumber();
    } catch (err) {
      log.error(`Encountered error trying to get block height: ${err}`);
      await this._reconnect();
    }
    return result;
  }

  async start({ name, contract, buffer }) {
    if (this._hasStartedListening[name]) { return; }

    await this.stop(name);
    this._hasStartedListening[name] = true;
    this._contractDefinitions[name] = contract;

    let { abi, addresses, pastAddresses } = contract;
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

          if (buffer) {
            buffer.loadModels(name, null, hints);
          }
        }
      });
    }

    if (!pastAddresses) { return; }

    for (let branch of Object.keys(pastAddresses)) {
      if (!this._providers[branch]) { continue; }

      for (let pastAddress of pastAddresses[branch]) {
        // TODO we should ideally not be using the curent ABI against a past contract
        let aContract = new this._providers[branch].eth.Contract(abi, pastAddress);
        if (!this._pastContracts[branch]) {
          this._pastContracts[branch] = {};
        }
        this._pastContracts[branch][pastAddress] = aContract;
      }
    }
  }

  async callContractMethod(contract, methodName, arg) {
    let result;
    try {
      result = arg == null ? await contract.methods[methodName]().call() :
                             await contract.methods[methodName](arg).call();
    } catch (err) {
      log.error(`Encountered error invoking contract method name '${methodName}'${arg != null ? " with parameter '" + arg + "'" : ''}. ${err}`);
      await this._reconnect();
    }
    return result;
  }

  async shouldSkipIndexing(contractName, branch) {
    let contract = this._contracts[branch][contractName];
    let skipMethods = get(this._contractDefinitions, `${contractName}.indexingSkipIndicators`);
    if (!contract || !skipMethods || !skipMethods.length) { return false; }

    for (let method of skipMethods) {
      let shouldSkip = await this.callContractMethod(contract, method);
      if (shouldSkip) { return true; }
    }

    return false;
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
      attributes[`${contract}-${dasherize(method)}`] = await this.callContractMethod(aContract, method);
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

    let data = await this.callContractMethod(aContract, methodName, id);
    log.debug(`retrieved contract data for contract ${contractName}.${methodName}(${id || ''}): ${data}`);
    return { data, methodName };
  }

  async getPastEventsAsHints(blockHeights) {
    log.debug(`getting past events as hints for contracts ${blockHeights ? JSON.stringify(blockHeights) : ''}`);
    let hints = [];

    await this._reconnectPromise;
    for (let branch of Object.keys(this._contracts)) {
      for (let contract of Object.keys(this._contracts[branch])) {
        let pastAddresses = get(this._contractDefinitions[contract], `pastAddresses.${branch}`) || [];
        let aContract = this._contracts[branch][contract];
        let contractHints = [];
        let contractProviders = pastAddresses.map(address => {
          return { address, provider: this._pastContracts[branch][address] };
        });
        contractProviders.push({
          address: this._contractDefinitions[contract]["addresses"][branch],
          provider: aContract
        });

        for (let { address, provider } of contractProviders) {
          for (let event of Object.keys(this._contractDefinitions[contract].eventContentTriggers || [])) {
            let rawHints = [], events = [];
            let lastIndexedBlockHeight = get(blockHeights, branch);
            try {
              // TODO we might need to chunk this so we don't blow past the websocket max frame size in the web3 provider: https://github.com/ethereum/web3.js/issues/1297
              events = await provider.getPastEvents(event, { fromBlock: lastIndexedBlockHeight ? lastIndexedBlockHeight + 1 : 0, toBlock: 'latest' });
            } catch (err) {
              // for some reason web3 on the private blockchain throws an error when it cannot find any of the requested events
              log.info(`could not find any past contract events of contract ${contract}, address ${address} for event ${event}. ${err.message}`);
            }
            log.trace(`discovered ${event} events for contract ${contract}, address ${address}: ${JSON.stringify(events, null, 2)}`);

            for (let rawEvent of events) {
              rawHints = rawHints.concat(this._generateHintsFromEvent({ branch, contract, event: rawEvent }));
            }
            contractHints = contractHints.concat(uniqWith(rawHints, isEqual));
          }
          hints = hints.concat(uniqWith(contractHints, isEqual));
        }
      }
    }
    log.info(`Generated ${hints.length} hints from past contract events since blockheight ${JSON.stringify(blockHeights)}`);
    log.debug(`discovered contract events resulting in hints: ${JSON.stringify(hints, null, 2)}`);
    return hints;
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
};

function  getEventDefinitions(contractName, { abi }) {
  let events = {};

  for (let event of abi.filter(item => item.type === 'event')) {
    events[event.name] = event;
  }
  return events;
}
