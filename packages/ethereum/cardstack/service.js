const Web3 = require('web3');
const log = require('@cardstack/logger')('cardstack/ethereum/service');
const { declareInjections } = require('@cardstack/di');
const { uniqWith, isEqual } = require('lodash');

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

module.exports = declareInjections({
  indexer: 'hub:indexers'
},

class EthereumService {

  static create(...args) {
    return new this(...args);
  }

  constructor({ indexer }) {
    this._indexer = indexer;
    this._providers = new WeakMap();
    this._eventListeners = new WeakMap();
    this._hasStartedListening = false;
    this._hasConnected = false;
    this._isIndexing = false;
    this._indexQueue = [];
    this._processQueueTimeoutMs = 1000;
    this._processQueueTimeout = null;
    this._contractDefinitions = null;
    this._branches = null;
    this._eventDefinitions = new WeakMap();
    this._contracts = new WeakMap();
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
    }
  }

  async _reconnect() {
    log.info("reconnecting ethereum service");

    this._hasConnected = false;
    this._hasStartedListening = false;
    this._contracts = new WeakMap();
    this._providers = new WeakMap();
    this._eventListeners = new WeakMap();
    this._eventDefinitions = new WeakMap();

    this.connect(this._branches);
    await this.start(this._contractDefinitions);
  }

  async stop() {
    log.info("stopping ethereum service");
    for (let listener of Object.keys(this._eventListeners)) {
      this._eventListeners[listener].unsubscribe();
    }
    clearTimeout(this._processQueueTimeout);
    this._eventListeners = {};
    this._hasStartedListening = false;
  }

  async start(contracts) {
    if (this._hasStartedListening) { return; }

    await this.stop();
    log.info("starting ethereum service");
    this._hasStartedListening = true;
    this._contractDefinitions = contracts;

    for (let contract of Object.keys(contracts)) {
      let { abi, addresses } = contracts[contract];
      this._eventDefinitions[contract] = getEventDefinitions(contract, contracts);

      for (let branch of Object.keys(addresses)) {
        if (!this._providers[branch]) { continue; }

        log.info(`starting listeners for contract ${contract} at ${addresses[branch]}`);

        let aContract = new this._providers[branch].eth.Contract(abi, addresses[branch]);
        if (!this._contracts[branch]) {
          this._contracts[branch] = {};
        }
        this._contracts[branch][contract] = aContract;

        this._eventListeners[contract] = aContract.events.allEvents(async (error, event) => {
          if (error) {
            log.error(`error received listening for events from contract ${contract}: ${error.reason}`);
            if (error.type === 'close') {
              await this._reconnect();
            }
          } else {
            log.trace(`contract event received for ${contract}: ${JSON.stringify(event, null, 2)}`);
            let hints = this._generateHintsFromEvent({ branch, contract, event });
            log.debug("addings hints to queue", JSON.stringify(hints, null, 2));

            this._indexQueue = this._indexQueue.concat(hints);
          }
        });
      }
    }

    this._processQueue();
  }

  async getContractInfo({ branch, contract }) {
    log.debug(`getting all top level contract info for contract: ${contract}, branch: ${branch}`);
    let contractDefinition = this._contractDefinitions[contract];
    if (!contractDefinition) { throw new Error(`cannot find contract with branch: ${branch}, contract name: ${contract}`); }

    let aContract = this._contracts[branch][contract];
    if (!aContract) {
      log.warn(`a contract instance is not yet available for contract: ${contract}, branch: ${branch}`);
      return;
    }

    let address = contractDefinition.addresses[branch];
    let attributes;
    try {
      attributes = {
        'ethereum-address': address,
        'balance-wei': await this._providers[branch].eth.getBalance(address)
      };

      let methods = contractDefinition.abi.filter(item => item.type === 'function' &&
                                                          item.constant &&
                                                          !item.inputs.length)
                                          .map(item => item.name);
      for (let method of methods) {
        attributes[`${contract}-${method}`] = await aContract.methods[method]().call();
      }
    } catch (err) {
      debugger;
    }

    let model = { id: address, type: contract, attributes };

    log.trace(`retrieved contract model for contract ${contract}, branch ${branch}, address ${address}: ${JSON.stringify(model, null, 2)}`);
    return model;
  }

  async getContractInfoFromHint({ id, branch, type, contract}) {
    log.debug(`getting contract data for id: ${id}, type: ${type}, branch: ${branch}`);
    if (!branch || !type || !id) { return; }

    let tokenIndex = type.lastIndexOf('-');
    let method = type.substring(tokenIndex + 1);

    if (!this._contracts[branch] || !this._contracts[branch][contract]) {
      throw new Error(`cannot find contract with branch: ${branch}, type: ${type}`);
    }

    let aContract = this._contracts[branch][contract];
    let contractInfo;
    try {
      contractInfo = await aContract.methods[method](id).call();
    } catch (err) {
      debugger;
    }
    log.info(`retreved contract data for contract ${contract}.${method}(${id || ''}): ${contractInfo}`);
    return contractInfo;
  }

  async getPastEventsAsHints() {
    log.debug(`getting past events as hints for contracts`);
    let hints = [];

    for (let branch of Object.keys(this._contracts)) {
      for (let contract of Object.keys(this._contracts[branch])) {
        let aContract = this._contracts[branch][contract];
        let contractHints = [];

        for (let event of Object.keys(this._contractDefinitions[contract].eventContentTriggers || [])) {
          let rawHints = [], events = [];
          try {
            // TODO we might need to chunk this so we don't blow past the websocket max frame size in the web3 provider: https://github.com/ethereum/web3.js/issues/1297
            events = await aContract.getPastEvents(event, { fromBlock: 0, toBlock: 'latest' });
          } catch (err) {
            // for some reason web3 on the private blockchain throws an error when it cannot find any of the requested events
            log.info(`could not find any past contract events of contract ${contract} for event ${event}`);
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
    return hints;
  }

  _setProcessQueueTimeout(timeout) {
    clearTimeout(this._processQueueTimeout);

    this._processQueueTimeoutMs = timeout;
    this._processQueue();
  }

   // the web3 event handler assumes synchronous event callback functions,
   // so we're dealing with the async nature of our event callbacks in this
   // queue processor.
  _processQueue() {
    let scheduleNextProcess = () => setTimeout(() => this._processQueue(), this._processQueueTimeoutMs);

    if (this._indexQueue.length && !this._isIndexing) {
      this._isIndexing = true;
      let queue = this._indexQueue;
      this._indexQueue = [];
      let hints = uniqWith(queue, isEqual);

      log.debug("processing index queue ", hints);
      this._indexerPromise = this._indexer.update({ forceRefresh: true, hints });

      let _finally = () => this._isIndexing = false;

      Promise.resolve(this._indexerPromise)
        .then(() => this._processQueueTimeout = _finally() && scheduleNextProcess())
        .catch(err => _finally() && log.error(`error encountered processing indexer queue: ${err.message}`));
    } else {
      this._processQueueTimeout = scheduleNextProcess();
    }
  }

  _generateHintsFromEvent({ branch, contract, event }) {
    let contractHint = { branch, type: contract, id: this._contractDefinitions[contract].addresses[branch], isContractType: true };
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

function  getEventDefinitions(contractName, contractDefinitions) {
  let { abi } = contractDefinitions[contractName];
  let events = {};

  for (let event of abi.filter(item => item.type === 'event')) {
    events[event.name] = event;
  }
  return events;
}
