const { declareInjections } = require('@cardstack/di');
const { difference, flatMap, uniqBy, intersection, get } = require('lodash');
const { utils: { BN, toChecksumAddress } } = require('web3');
const Session = require('@cardstack/plugin-utils/session');
const log = require('@cardstack/logger')('cardstack/ethereum/transaction-indexer');

const DEFAULT_MAX_ADDRESSES_TRACKED = 10000;

module.exports = declareInjections({
  indexer: 'hub:indexers',
  controllingBranch: 'hub:controlling-branch',
  searchers: 'hub:searchers',
  schema: 'hub:current-schema',
  pgsearchClient: `plugin-client:${require.resolve('@cardstack/pgsearch/client')}`
},

class TransactionIndexer {

  static create(...args) {
    return new this(...args);
  }

  constructor({ indexer, pgsearchClient, schema, searchers, controllingBranch}) {
    this.ethereumClient = null;
    this.addressIndexing = null;
    this.indexer = indexer;
    this.searchers = searchers;
    this.schema = schema;
    this.pgsearchClient = pgsearchClient;
    this.controllingBranch = controllingBranch;
    this._indexingPromise = null; // this is exposed to the tests as web3 has poor support for async in event handlers
    this._eventProcessingPromise = null; // this is exposed to the tests to deal with indexing event async
    this._setupPromise = this._ensureClient();
    this._boundEventListeners = false;
    this._startedPromise = new Promise(res => this._hasStartedCallBack = res);
  }

  async start(addressIndexing, ethereumClient) {
    await this._setupPromise;

    this.addressIndexing = addressIndexing;
    this.ethereumClient = ethereumClient;

    await this._startTrackedAddressListening();

    await this.ethereumClient.startNewBlockListening(this);
    this._hasStartedCallBack();
  }

  async ensureStarted() {
    await this._setupPromise;
    await this._startedPromise;
  }

  async index(opts) {
    this._indexingPromise = Promise.resolve(this._indexingPromise)
      .then(() => this._index(opts));

    return await this._indexingPromise;
  }

  async getBlockHeight() {
    return await this.ethereumClient.getBlockHeight();
  }

  async getTrackedAddresses() {
    let trackedAddressContentType = get(this, 'addressIndexing.trackedAddressContentType');
    let trackedAddressField = get(this, 'addressIndexing.trackedAddressField');
    if (!trackedAddressContentType || !trackedAddressField) { return; }

    let size = get(this, 'addressIndexing.maxAddressesTracked') || DEFAULT_MAX_ADDRESSES_TRACKED;
    let addressQuery = {
      filter: { type: { exact: trackedAddressContentType } },
      page: { size }
    };

    let { data:results } = await this.searchers.searchFromControllingBranch(Session.INTERNAL_PRIVILEGED, addressQuery);
    if (results.length === size) {
      throw new Error(`There are more tracked-ethereum-addresses than the system is configured to return (${size} addresses). Increase the max number of tracked addresses in 'params.addressIndexing.maxAddressesTracked' for data source configuration'.`);
    }

    let field = trackedAddressField === 'id' ? 'id' : `attributes.${trackedAddressField}`;
    return flatMap(results, i => get(i, field)).map(i => i.toLowerCase());
  }

  async _startTrackedAddressListening() {
    if (this._boundEventListeners) { return; }

    this._boundEventListeners = true;
    let trackedAddressContentType = get(this, 'addressIndexing.trackedAddressContentType');
    let trackedAddressField = get(this, 'addressIndexing.trackedAddressField');
    if (!trackedAddressContentType || !trackedAddressField) { return; }

    let schema = await this.schema.forControllingBranch();
    if (!schema.types.get(trackedAddressContentType)) {
      throw new Error(`The configured trackedAddressContentType '${trackedAddressContentType}' is not a valid type.`);
    }
    if (!schema.realAndComputedFields.get(trackedAddressField)) {
      throw new Error(`The configured trackedAddressField '${trackedAddressField}' is not a valid field.`);
    }

    this.pgsearchClient.on('add', async (evt) => {
      let { type } = evt;
      if (type !== trackedAddressContentType) { return; }

      this._eventProcessingPromise = Promise.resolve(this._eventProcessingPromise)
        .then(() => this._processIndexingAddEvent(trackedAddressField, evt));

      return await this._eventProcessingPromise;
    });

    this.pgsearchClient.on('delete', async (evt) => {
      let { type } = evt;
      if (type !== trackedAddressContentType) { return; }

      this._eventProcessingPromise = Promise.resolve(this._eventProcessingPromise)
        .then(() => this._processIndexingDeleteEvent(trackedAddressField, evt));

      return await this._eventProcessingPromise;
    });
  }

  async _processIndexingAddEvent(trackedAddressField, { doc: { data: trackedResource } }) {
    let field = trackedAddressField === 'id' ? 'id' : `attributes.${trackedAddressField}`;
    let fieldValue = get(trackedResource, field);
    if (!fieldValue) { return; }

    let addresses = (Array.isArray(fieldValue) ? fieldValue : [fieldValue]).map(i => i.toLowerCase());
    if (!addresses.length) { return; }

    let trackedAddressCounts = (await this.getTrackedAddresses()).reduce((totals, i) => {
      if (!addresses.includes(i)) { return totals; }
      if (!totals[i]) {
        totals[i] = 0;
      }
      totals[i]++;
      return totals;
    }, {});

    let newAddresses = Object.keys(trackedAddressCounts).filter(address => trackedAddressCounts[address] < 2); // new address will already be in the index at this point so make sure not to count it
    if (newAddresses.length) {
      // intentionally not awaiting (indexing could take awhile), make sure to use TransactionIndexer._indexingPromise in the tests so async doesn't leak
      this.index({ startIndexingAddresses: newAddresses });
    }
  }

  async _processIndexingDeleteEvent(trackedAddressField, { doc: { data: trackedResource } }) {
    let field = trackedAddressField === 'id' ? 'id' : `attributes.${trackedAddressField}`;
    let fieldValue = get(trackedResource, field);
    if (!fieldValue) { return; }

    let addresses = (Array.isArray(fieldValue) ? fieldValue : [fieldValue]).map(i => i.toLowerCase());
    if (!addresses.length) { return; }

    let deletedAddresses = difference(addresses, await this.getTrackedAddresses());
    if (deletedAddresses.length) {
      // intentionally not awaiting (indexing could take awhile), make sure to use TransactionIndexer._indexingPromise in the tests so async doesn't leak
      this.index({ stopIndexingAddresses: deletedAddresses });
    }
  }

  async _ensureClient() {
    await this.pgsearchClient.ensureDatabaseSetup();
  }

  async _index({
    lastIndexedBlockHeight,
    onlyBlockNumber,
    startIndexingAddresses,
    stopIndexingAddresses,
  }) {
    await this.ensureStarted();

    if (Array.isArray(stopIndexingAddresses)) {
      return await this._stopIndexingAddresses(stopIndexingAddresses);
    }

    let currentBlockNumber = await this.ethereumClient.getBlockHeight();
    let trackedAddresses = Array.isArray(startIndexingAddresses) ? startIndexingAddresses : await this.getTrackedAddresses();
    if (!trackedAddresses || !trackedAddresses.length) {
      log.info(`There are no tracked-ethereum-addresses to index.`);
      return;
    }

    if (onlyBlockNumber) {
      await this._indexBlock(trackedAddresses, onlyBlockNumber);
    } else {
      await this._indexBlocks(trackedAddresses, lastIndexedBlockHeight, currentBlockNumber);
      return currentBlockNumber;
    }
  }

  async _indexBlocks(trackedAddresses, lastIndexedBlockHeight = 0, currentBlockNumber) {
    let lastIndexedAddressesBlockHeights = lastIndexedBlockHeights(await this._getIndexedAddresses());

    // if an address document indicates that it has been indexed more recently than the hub:indexers.update() was kicked off, then
    // use that as the block height the document was indexed at as it will always be more accurate.
    let oldestIndexedBlock = Object.keys(lastIndexedAddressesBlockHeights).length ?
      Object.keys(lastIndexedAddressesBlockHeights)
        .reduce((oldest, address) =>
          Math.min(oldest, Math.max(lastIndexedBlockHeight, lastIndexedAddressesBlockHeights[address])),
          currentBlockNumber) : 0;

    let newAddresses = trackedAddresses.filter(address => !lastIndexedAddressesBlockHeights[address]);
    let newAddressesInfo = {};
    if (newAddresses.length) {
      let batch = this.pgsearchClient.beginBatch(this.schema, this.searchers);
      for (let address of newAddresses) {
        let numSentTxns = await this.ethereumClient.getSentTransactionCount(address, currentBlockNumber);
        let balance = new BN(await this.ethereumClient.getBalance(address, currentBlockNumber));
        newAddressesInfo[address] = { numSentTxns, balance };

        // First create the ethereum address so the client has something to look at while it
        // waits for the transactions to appear in the index, as transaction load may take awhile
        await this._prepopulateAddressResource(batch, address, currentBlockNumber);
      }
      await batch.done();
    }

    let discoveredTransactions = {};
    let addressesNonces = {};
    let batch = this.pgsearchClient.beginBatch(this.schema, this.searchers);

    // Using the number of sent transactions and the balance as a heuristic to prevent having to crawl to
    // the genesis block when looking for transactions for an address. Using the available information about
    // the current state (number of "from" transactions and the current balance), it goes back in time until
    // at least so many "from" transactions have been found, and then continues going back until the balance
    // reaches 0. The inherent limitation is that 0-value transactions before the account was funded will not
    // be found. These sorts of transactions are indicative of interacting with a smart contract, for which
    // it's probably better suited to use this plugin's contract indexing for these types of transactions.
    for (let blockNumber = currentBlockNumber;
      blockNumber >= 0 &&
        ((oldestIndexedBlock && blockNumber > oldestIndexedBlock) ||
          hasBalance(newAddressesInfo) ||
          hasSentTxns(newAddressesInfo));
      blockNumber--) {
      await this._processBlock({
        trackedAddresses,
        lastIndexedAddressesBlockHeights,
        newAddresses,
        newAddressesInfo,
        blockNumber,
        batch,
        discoveredTransactions,
        addressesNonces
      });
    }

    let addressesWithTransactions = Object.keys(discoveredTransactions);
    for (let address of addressesWithTransactions) {
      await this._indexAddressResource(batch, address, currentBlockNumber, discoveredTransactions[address], addressesNonces[address]);
    }

    let newAdressesWithoutTransactions = newAddresses.filter(address => !addressesWithTransactions.includes(address));
    for (let address of newAdressesWithoutTransactions) {
      await this._indexAddressResource(batch, address, currentBlockNumber);
    }

    await batch.done();
  }

  async _indexBlock(trackedAddresses, blockNumber) {
    let discoveredTransactions = {};
    let addressesNonces = {};
    let lastIndexedAddressesBlockHeights = lastIndexedBlockHeights(await this._getIndexedAddresses());

    let batch = this.pgsearchClient.beginBatch(this.schema, this.searchers);
    await this._processBlock({
      trackedAddresses,
      blockNumber,
      batch,
      lastIndexedAddressesBlockHeights,
      discoveredTransactions,
      addressesNonces
    });

    for (let address of Object.keys(discoveredTransactions)) {
      await this._indexAddressResource(batch, address, blockNumber, discoveredTransactions[address], addressesNonces[address]);
    }
    await batch.done();
  }

  async _processBlock({
    trackedAddresses,
    lastIndexedAddressesBlockHeights = {},
    newAddresses = [],
    newAddressesInfo = {},
    blockNumber,
    batch,
    discoveredTransactions,
    addressesNonces }) {
    let block = await this.ethereumClient.getBlock(blockNumber);
    if (!block || !block.transactions.length) { return; }

    let addressesEligibleForIndexing = trackedAddresses.filter(address =>
      (lastIndexedAddressesBlockHeights[address] && lastIndexedAddressesBlockHeights[address] < blockNumber) ||
      (newAddressesInfo[address] && newAddressesInfo[address].balance.gt(0)) ||
      (newAddressesInfo[address] && newAddressesInfo[address].numSentTxns > 0));
    for (let transaction of block.transactions) {
      let addressesToIndex = intersection(addressesEligibleForIndexing, [transaction.from.toLowerCase(), (transaction.to || '').toLowerCase()]);
      if (!addressesToIndex.length) { continue; }

      let isSuccessfulTxn;
      try {
        await this.searchers.getFromControllingBranch(Session.INTERNAL_PRIVILEGED, 'ethereum-transactions', transaction.hash);
      } catch (e) {
        if (e.status === 404) {
          log.trace(`index of ethereum transactions found transaction to index at block ${blockNumber}, ${JSON.stringify(transaction, null, 2)}`);
          let resource = await this._indexTransactionResource(batch, block, transaction);
          isSuccessfulTxn = resource && get(resource, 'attributes.transaction-successful');
        } else { throw e; }
      }

      for (let address of addressesToIndex) {
        discoveredTransactions[address] = discoveredTransactions[address] || [];
        discoveredTransactions[address].unshift(transaction.hash);
        addressesNonces[address] = Math.max(addressesNonces[address] || 0, transaction.nonce);
      }

      if (isSuccessfulTxn && newAddresses.includes(transaction.from.toLowerCase())) {
        if (transaction.to &&
          transaction.value !== '0' &&
          transaction.from.toLowerCase() !== transaction.to.toLowerCase()) {
          let balance = newAddressesInfo[transaction.from.toLowerCase()].balance;
          newAddressesInfo[transaction.from.toLowerCase()].balance = balance.add(new BN(transaction.value));
        }
        newAddressesInfo[transaction.from.toLowerCase()].numSentTxns--;
      }

      if (isSuccessfulTxn && transaction.to && newAddresses.includes(transaction.to.toLowerCase())) {
        if (transaction.from.toLowerCase() !== transaction.to.toLowerCase()) {
          let balance = newAddressesInfo[transaction.to.toLowerCase()].balance;
          newAddressesInfo[transaction.to.toLowerCase()].balance = balance.sub(new BN(transaction.value));
        }
      }
    }
  }

  async _stopIndexingAddresses(addresses) {
    if (!addresses || !addresses.length) { return; }

    let batch = this.pgsearchClient.beginBatch(this.schema, this.searchers);
    for (let address of addresses) {
      let document = await this.searchers.getFromControllingBranch(Session.INTERNAL_PRIVILEGED,
        'ethereum-addresses',
        address,
        ['transactions.from-address', 'transactions.to-address']);
      let { included = [], data: resource } = document;

      // Only remove transactions that are not being referred to from other ethereum-addresses.
      // Rely on fact that hub will not populate ethereum-addresses in the jsonapi included field that are not indexed
      let includedAddresses = included.filter(i => i.type === 'ethereum-addresses').map(i => i.id);
      let includedTxns = included.filter(i => i.type === 'ethereum-transactions');
      for (let transaction of includedTxns) {
        let txnAddresses = [get(transaction, 'relationships.from-address.data.id'),
        get(transaction, 'relationships.to-address.data.id')]
          .filter(i => Boolean(i) && i.toLowerCase() !== address.toLowerCase())
          .filter(i => includedAddresses.includes(i));
        if (!txnAddresses.length) {
          await batch.deleteDocument(await this._createDocumentContext(transaction));
        }
      }

      await batch.deleteDocument(await this._createDocumentContext(resource));
    }

    await batch.done();
  }

  async _getIndexedAddresses() {
    let size = get(this, 'addressIndexing.maxAddressesTracked') || DEFAULT_MAX_ADDRESSES_TRACKED;
    let { data: indexedAddresses } = await this.searchers.searchFromControllingBranch(Session.INTERNAL_PRIVILEGED, {
      filter: { type: { exact: 'ethereum-addresses' } },
      page: { size }
    });

    return indexedAddresses;
  }

  async _indexTransactionResource(batch, block, rawTransaction) {
    if (!rawTransaction) { return; }

    let receipt = await this.ethereumClient.getTransactionReceipt(rawTransaction.hash);
    if (!receipt) {
      throw new Error(`No transaction reciept exists for txn hash ${rawTransaction.hash}`);
    }
    let status = typeof receipt.status === 'boolean' ? receipt.status : Boolean(parseInt(receipt.status, 16));

    let resource = {
      id: rawTransaction.hash,
      type: 'ethereum-transactions',
      attributes: {
        'block-number': rawTransaction.blockNumber,
        'timestamp': block.timestamp,
        'transaction-hash': rawTransaction.hash,
        'block-hash': rawTransaction.blockHash,
        'transaction-nonce': rawTransaction.nonce,
        'transaction-index': rawTransaction.transactionIndex,
        'transaction-value': rawTransaction.value,
        'transaction-successful': status,
        'gas-used': receipt.gasUsed,
        'cumulative-gas-used': receipt.cumulativeGasUsed,
        'gas': rawTransaction.gas,
        'gas-price': rawTransaction.gasPrice,
        'transaction-data': rawTransaction.input
      },
      relationships: {
        'from-address': {data: { type: 'ethereum-addresses', id: rawTransaction.from.toLowerCase() } },
      }
    };

    if (rawTransaction.to) {
      resource.relationships['to-address'] = { data: { type: 'ethereum-addresses', id: rawTransaction.to.toLowerCase() } };
    }

    await this._indexResource(batch, resource);
    return resource;
  }

  async _prepopulateAddressResource(batch, address, blockHeight) {
    if (!address) { return; }

    let addressResource = {
      id: address.toLowerCase(),
      type: 'ethereum-addresses',
      attributes: {
        'ethereum-address': toChecksumAddress(address),
        'balance': (await this.ethereumClient.getBalance(address, blockHeight)).toString()
      },
      relationships: {
        transactions: { data: [] }
      },
      meta: {
        blockHeight,
        version: 0,
        loadingTransactions: true
      }
    };

    return await this._indexResource(batch, addressResource);
  }

  async _indexAddressResource(batch, address, blockHeight, transactions = [], lastTxnNonce = 0) {
    if (!address) { return; }

    let addressResource;
    try {
      addressResource = await this.searchers.getFromControllingBranch(Session.INTERNAL_PRIVILEGED, 'ethereum-addresses', address.toLowerCase());
    } catch (err) {
      if (err.status !== 404) { throw err; }
    }
    if (addressResource) {
      addressResource = addressResource.data;
      let { meta: { version } } = addressResource;
      if (version && lastTxnNonce < version) {
        throw new Error(`Cannot index ethereum-addresses/${address} last txn nonce '${lastTxnNonce}' is less than currently indexed document's last txn nonce '${version}'.`);
      }
    } else {
      addressResource = {
        id: address.toLowerCase(),
        type: 'ethereum-addresses',
        attributes: {
          'ethereum-address': toChecksumAddress(address)
        },
        relationships: {
          transactions: { data: [] }
        },
      };
    }

    addressResource.attributes['balance'] = (await this.ethereumClient.getBalance(address, blockHeight)).toString();
    let updatedTransactions = addressResource.relationships.transactions.data.concat(transactions.map(txn => {
      return { type: 'ethereum-transactions', id: txn };
    }));

    addressResource.relationships.transactions.data = uniqBy(updatedTransactions, 'id');
    addressResource.meta = addressResource.meta || {};
    addressResource.meta.blockHeight = blockHeight;
    addressResource.meta.version = lastTxnNonce;
    addressResource.meta.loadingTransactions = undefined;

    return await this._indexResource(batch, addressResource);
  }

  async _removeResourceFromIndex(batch, type, id) {
    log.trace('removing model from index ${type}/${id}');
    await batch.saveDocument(await this._createDocumentContext({ type, id }));
  }

  async _indexResource(batch, record) {
    log.trace('indexing model %j', record);
    await batch.saveDocument(await this._createDocumentContext(record));
  }

  async _createDocumentContext(record) {
    let { id, type } = record;
    let schema = await this.schema.forControllingBranch();
    let contentType = schema.types.get(type);
    let sourceId = contentType.dataSource.id;
    return this.searchers.createDocumentContext({
      id,
      type,
      branch: this.controllingBranch.name,
      schema,
      sourceId,
      upstreamDoc: { data: record }
    });
  }
});

function hasBalance(addressesInfo) {
  let balances = Object.keys(addressesInfo).map(address => addressesInfo[address].balance);
  return balances.some(b => b.gt(0));
}

function hasSentTxns(addressesInfo) {
  let numSentTxns = Object.keys(addressesInfo).map(address => addressesInfo[address].numSentTxns);
  return numSentTxns.some(n => n > 0);
}

function lastIndexedBlockHeights(indexedAddresses) {
  let lastIndexedAddressesBlockHeights = {};
  for (let address of indexedAddresses) {
    lastIndexedAddressesBlockHeights[address.id.toLowerCase()] = get(address, 'meta.blockHeight');
  }
  return lastIndexedAddressesBlockHeights;
}
