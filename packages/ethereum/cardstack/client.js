const Ember = require('ember-source/dist/ember.debug');
const { dasherize, camelize, capitalize } = Ember.String;
const { pluralize, singularize } = require('inflection');
const Web3 = require('web3');
const log = require('@cardstack/logger')('cardstack/ethereum/client');
const { get } = require('lodash');
const { promisify } = require('util');
const timeout = promisify(setTimeout);

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
const MAX_WS_MESSAGE_SIZE_BYTES = 20000000;

module.exports = class EthereumClient {

  static create(...args) {
    return new this(...args);
  }

  constructor() {
    this._provider = null;
    this._eventListeners = {};
    this._newBlocksEventListener = null;
    this._hasStartedListening = {};
    this._hasStartedListeningForNewBlocks = false;
    this._hasConnected = false;
    this._contractDefinitions = {};
    this._jsonRpcUrl = null;
    this._eventDefinitions = {};
    this._contracts = {};
  }

  connect(jsonRpcUrl) {
    if (this._hasConnected) { return; }

    this._jsonRpcUrl = jsonRpcUrl;
    this._hasConnected = true;
    log.info(`connecting to ethereum JSON RPC provider at: ${jsonRpcUrl}`);
    this._provider = new Web3(new Web3.providers.WebsocketProvider(jsonRpcUrl));

    // The default WS message size is too small to handle much activity, and sadly the WS configuration
    // is not exposed from web3, so we need to reach a bit deep into the web3 WS provider to adjust the
    // websocket client config.
    let websocketConfig = get(this, `_provider.currentProvider.connection._client.config`);
    if (websocketConfig) {
      websocketConfig.maxReceivedFrameSize = MAX_WS_MESSAGE_SIZE_BYTES;
      websocketConfig.maxReceivedMessageSize = MAX_WS_MESSAGE_SIZE_BYTES;
    }
  }

  async _reconnect() {
    log.info("start reconnecting ethereum client...");

    let done;
    this._reconnectPromise = new Promise(r => done = r);

    await this.stopAll();
    await timeout(10 * 1000); // cool down period before we start issuing requests again

    this._contracts = {};
    this._provider = null;
    this._eventListeners = {};
    this._eventDefinitions = {};

    this.connect(this._jsonRpcUrl);

    for (let name of Object.keys(this._contractDefinitions)) {
      await this.startEventListening({
        name,
        contract: this._contractDefinitions[name],
      });
    }

    log.info("finished trying to reconnect to ethereum client");
    done();
  }

  async stopAll() {
    this._hasConnected = false;
    for (let name of Object.keys(this._eventListeners)) {
      await this.stop(name);
    }

    await this.stopListeningForNewBlocks();
  }

  async stop(name) {
    log.info("stopping event listening for contract " + name);

    if (!this._eventListeners[name]) { return; }

    this._eventListeners[name].unsubscribe();
    this._eventListeners[name] = null;
    this._hasStartedListening[name] = false;
  }

  async stopListeningForNewBlocks() {
    log.info("stopping event listening for new blocks");

    if (!this._newBlocksEventListener) { return; }

    this._newBlocksEventListener.unsubscribe();
    this._newBlocksEventListener = null;
    this._hasStartedListeningForNewBlocks = false;
  }

  async getBlockHeight() {
    await this._reconnectPromise;

    let result;
    try {
      result = await this._provider.eth.getBlockNumber();
    } catch (err) {
      log.error(`Encountered error trying to get block height: ${err}`);
      await this._reconnect();
    }
    return result;
  }

  async getBlock(blockHeight) {
    await this._reconnectPromise;

    let result;
    try {
      result = await this._provider.eth.getBlock(blockHeight, true);
    } catch (err) {
      log.error(`Encountered error trying to get block #${blockHeight}: ${err}`);
      await this._reconnect();
    }
    return result;
  }

  async getTransactionReceipt(txnHash) {
    await this._reconnectPromise;

    let result;
    try {
      result = await this._provider.eth.getTransactionReceipt(txnHash);
    } catch (err) {
      log.error(`Encountered error trying to get transactionReciept for txn ${txnHash}: ${err}`);
      await this._reconnect();
    }
    return result;
  }

  async getSentTransactionCount(address, blockHeight) {
    await this._reconnectPromise;

    let count;
    try {
      count = await this._provider.eth.getTransactionCount(address, blockHeight);
    } catch (err) {
      log.error(`Encountered error trying to get transaction count for address ${address}: ${err}`);
      await this._reconnect();
    }
    return count;
  }

  async getBalance(address, blockHeight) {
    await this._reconnectPromise;

    let balance;
    try {
      balance = await this._provider.eth.getBalance(address, blockHeight);
    } catch (err) {
      log.error(`Encountered error trying to get balance for address ${address}: ${err}`);
      await this._reconnect();
    }
    return balance;
  }

  async startNewBlockListening(listener) {
    if (this._hasStartedListeningForNewBlocks) { return; }

    log.info(`starting listening for new blocks - first disconnecting any lingering listeners`);
    await this.stopListeningForNewBlocks();
    this._hasStartedListeningForNewBlocks = true;

    log.info(`starting listening for new blocks - now fashioning new listeners`);
    this._newBlocksEventListener = this._provider.eth.subscribe('newBlockHeaders', async (error, event) => {
      if (error) {
        log.error(`error received listening for new blocks`, error.message);
        if (error.type === 'close') {
          await this._reconnect();
        }
      } else if (listener) {
        log.debug(`Received new block #${event.number}`);
        log.trace(`Received new block header event: ${JSON.stringify(event, null, 2)}`);

        let blockNumber = event.number;
        // Note that this is an async function call, but that the web3 event handler doesnt support awaiting async function invocations.
        // Make sure to await the transactionIndexer's indexing promise when testing so that async is not leaked.
        listener.onNewBlockReceived(blockNumber);
      }
    });
    log.debug(`completed startup for new block event listeners`);
  }

  async startEventListening({ name, contract, eventIndexer }) {
    if (this._hasStartedListening[name]) { return; }

    await this.stop(name);
    this._hasStartedListening[name] = true;
    this._contractDefinitions[name] = contract;

    let { abi, address } = contract;
    this._eventDefinitions[name] = getEventDefinitions(name, contract);

    if (!this._provider) { return; }

    log.info(`starting listeners for contract ${name} at ${address}`);

    let aContract = new this._provider.eth.Contract(abi, address);
    this._contracts[name] = aContract;

    this._eventListeners[name] = aContract.events.allEvents(async (error, event) => {
      if (error) {
        log.error(`error received listening for events from contract ${name}: ${error.reason}`);
        if (error.type === 'close') {
          await this._reconnect();
        }
      } else {
        log.trace(`contract event received for ${name}: ${JSON.stringify(event, null, 2)}`);
        if (!Object.keys(this._contractDefinitions[name].eventContentTriggers || {}).includes(event.event)) {
          log.info(`skipping contract ${name} indexing for event ${event.event} since it is not configured as an event of interest`);
          return;
        }

        let historyData = this._generateHistoryDataFromEvent({ contract: name, event });
        log.debug("calling index for identifers", JSON.stringify(historyData.identifiers, null, 2));

        if (eventIndexer) {
          // Note that this is an async function call, but that the web3 event handler doesnt support awaiting async function invocations.
          // Make sure to await the eventIndexer's indexing promise when testing so that async is not leaked.
          eventIndexer.index(name, null, [historyData]);
        }
      }
    });
  }

  async callContractMethod(contract, methodName, arg) {
    let result;
    if (!contract || !methodName || typeof contract.methods[methodName] !== 'function') { return; }

    try {
      result = arg == null ? await contract.methods[methodName]().call() :
                             await contract.methods[methodName](arg).call();
    } catch (err) {
      log.error(`Encountered error invoking contract method name '${methodName}'${arg != null ? " with parameter '" + arg + "'" : ''}. ${err}`);
      await this._reconnect();
    }
    return result;
  }

  async shouldSkipIndexing(contractName) {
    if (!this._contracts[contractName]) {
      log.warn(`cannot find contract provider with contractName: ${contractName} when determining if indexing should be skipped`);
      return true;
    }

    let contract = this._contracts[contractName];
    let skipMethods = get(this._contractDefinitions, `${contractName}.indexingSkipIndicators`);
    if (!contract || !skipMethods || !skipMethods.length) { return false; }

    for (let method of skipMethods) {
      let shouldSkip = await this.callContractMethod(contract, method);
      if (shouldSkip) { return true; }
    }

    return false;
  }

  async getContractInfo({ contract, type }) {
    if (!contract && type) {
      log.debug(`getting all top level contract info for contract type: ${type}`);
      if (this._contractDefinitions[singularize(type)]) {
        contract = singularize(type);
      } else {
        contract = type;
      }
    }

    log.debug(`getting all top level contract info for contract: ${contract}`);
    let contractDefinition = this._contractDefinitions[contract];
    if (!contractDefinition) { throw new Error(`cannot find contract with contract name: ${contract}`); }

    let aContract = this._contracts[contract];
    if (!aContract) {
      log.warn(`a contract instance is not yet available for contract: ${contract}`);
      return;
    }

    await this._reconnectPromise;

    let { address } = contractDefinition;
    let attributes = {
      'ethereum-address': address,
      'balance-wei': await this._provider.eth.getBalance(address)
    };

    let methods = contractDefinition.abi.filter(item => item.type === 'function' &&
                                                        item.constant &&
                                                        !item.inputs.length)
                                        .map(item => item.name);
    for (let method of methods) {
      attributes[`${contract}-${dasherize(method)}`] = await this.callContractMethod(aContract, method);
    }

    let model = { id: address, type: pluralize(contract), attributes };

    log.trace(`retrieved contract model for contract ${contract}, address ${address}: ${JSON.stringify(model, null, 2)}`);
    return model;
  }

  async getContractInfoForIdentifier({ id, type, contractName}) {
    log.debug(`getting contract data for id: ${id}, type: ${type}, contractName: ${contractName}`);
    if (!type || !id) { return; }

    await this._reconnectPromise;

    let contractNameRegex = new RegExp(`^${contractName}-`);
    let dasherizedMethod = type.replace(contractNameRegex, '');
    let method = camelize(dasherizedMethod);

    if (!this._contracts[contractName]) {
      throw new Error(`cannot find contract provider with contractName: ${contractName} that will be used to access data for ${type}`);
    }

    let aContract = this._contracts[contractName];
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

  async getContractHistorySince(blockHeight) {
    log.debug(`getting past events as hints for contracts ${blockHeight ? 'at blockhieght: ' + blockHeight : ''}`);
    let history = [];

    await this._reconnectPromise;
    for (let contract of Object.keys(this._contracts)) {
      let provider = this._contracts[contract];
      let { address } = this._contractDefinitions[contract];
      for (let event of Object.keys(this._contractDefinitions[contract].eventContentTriggers || [])) {
        let events = [];
        let lastIndexedBlockHeight = blockHeight;
        try {
          // TODO we might need to chunk this so we don't blow past the websocket max frame size in the web3 provider: https://github.com/ethereum/web3.js/issues/1297
          events = await provider.getPastEvents(event, { fromBlock: lastIndexedBlockHeight ? lastIndexedBlockHeight + 1 : 0, toBlock: 'latest' });
        } catch (err) {
          // for some reason web3 on the private blockchain throws an error when it cannot find any of the requested events
          log.info(`could not find any past contract events of contract ${contract}, address ${address} for event ${event}. ${err.message}`);
        }
        log.trace(`discovered ${event} events for contract ${contract}, address ${address}: ${JSON.stringify(events, null, 2)}`);

        for (let event of events) {
          history.push(this._generateHistoryDataFromEvent({ contract, event }));
        }
      }
    }
    log.info(`Gathered ${history.length} events from contract history since blockheight ${blockHeight}`);
    log.debug(`Discovered contract history data: ${JSON.stringify(history, null, 2)}`);
    return history;
  }

  _generateHistoryDataFromEvent({ contract, event }) {
    let contractIdentifier = { type: pluralize(contract), id: this._contractDefinitions[contract].address, isContractType: true };
    let addressParams = this._eventDefinitions[contract][event.event].inputs.filter(input => input.type === 'address');
    let addresses = addressParams.map(param => event.returnValues[param.name]).filter(address => address !== NULL_ADDRESS);
    let contentTypes = this._contractDefinitions[contract].eventContentTriggers ? this._contractDefinitions[contract].eventContentTriggers[event.event] : null;

    let identifiers = [ contractIdentifier ];
    if (!contentTypes || !contentTypes.length ) {
      return { event, identifiers };
    }

    for (let type of contentTypes) {
      for (let id of addresses) {
        identifiers.push({ type, id, contract });
      }
    }

    return { event, identifiers };
  }
};

function  getEventDefinitions(contractName, { abi }) {
  let events = {};

  for (let event of abi.filter(item => item.type === 'event')) {
    events[event.name] = event;
  }
  return events;
}
