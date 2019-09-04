const { declareInjections } = require('@cardstack/di');
const { difference, flatMap, uniqBy, get } = require('lodash');
const { utils: { toChecksumAddress } } = require('web3');
const Session = require('@cardstack/plugin-utils/session');
const { coerce, valid, lt } = require('semver');
const log = require('@cardstack/logger')('cardstack/ethereum/transaction-indexer');

const DEFAULT_MAX_ADDRESSES_TRACKED = 1000000;

let indexJobNumber = 0;

module.exports = declareInjections({
  indexer: 'hub:indexers',
  searchers: 'hub:searchers',
  currentSchema: 'hub:current-schema',
  pgsearchClient: `plugin-client:${require.resolve('@cardstack/pgsearch/client')}`,
  transactionIndex: `plugin-client:${require.resolve('./transaction-index')}`
},

class TransactionIndexer {
  static create(...args) {
    return new this(...args);
  }

  constructor({ indexer, transactionIndex, pgsearchClient, currentSchema, searchers }) {
    this.ethereumClient = null;
    this.addressIndexing = null;
    this.indexer = indexer;
    this.searchers = searchers;
    this.currentSchema = currentSchema;
    this.transactionIndex = transactionIndex;
    this.pgsearchClient = pgsearchClient;
    this._indexingPromise = null; // this is exposed to the tests to deal with indexing event async
    this._eventProcessingPromise = null; // this is exposed to the tests to deal with indexing event async
    this._transactionIndexPromise = null;
    this._boundEventListeners = false;
    this._boundBlockListener = false;
    this._transactionIndexHasStarted = false;
    this._startedPromise = new Promise(res => this._hasStartedCallBack = res);
  }

  async start(addressIndexing, ethereumClient, jsonRpcUrls) {
    log.debug(`starting transaction-indexer`);

    log.debug(`waiting for pgsearch client to start`);
    await this.pgsearchClient.ensureDatabaseSetup();
    log.debug(`completed pgsearch client startup`);

    this.addressIndexing = addressIndexing;
    await this._startTrackedAddressListening();

    this.ethereumClient = ethereumClient;
    await this._ensureTransactionIndexStarted(ethereumClient, jsonRpcUrls);

    this._hasStartedCallBack();
    log.debug(`completed transaction-indexer startup`);
  }

  async index(opts={}) {
    opts.jobNumber = indexJobNumber++;
    log.debug(`queuing index job for ${JSON.stringify(opts)}`);

    this._indexingPromise = Promise.resolve(this._indexingPromise)
      .then(() => this._index(opts));

    return await this._indexingPromise;
  }

  async _ensureTransactionIndexStarted(ethereumClient, jsonRpcUrls) {
    if (this._transactionIndexHasStarted) { return; }

    if (!this._transactionIndexPromise) {
      this._transactionIndexPromise = this._startTransactionIndex(ethereumClient, jsonRpcUrls);
    }
    await this._transactionIndexPromise;

    this._transactionIndexHasStarted = true;
  }

  async _startTransactionIndex(ethereumClient, jsonRpcUrls) {
    await this.transactionIndex.start(ethereumClient, jsonRpcUrls);
    await this._startNewBlockListening();
  }

  async _getTrackedAddresses() {
    let trackedAddressContentType = get(this, 'addressIndexing.trackedAddressContentType');
    let trackedAddressField = get(this, 'addressIndexing.trackedAddressField');
    if (!trackedAddressContentType || !trackedAddressField) { return; }

    let size = get(this, 'addressIndexing.maxAddressesTracked') || DEFAULT_MAX_ADDRESSES_TRACKED;
    let addressQuery = {
      filter: { type: { exact: trackedAddressContentType } },
      page: { size }
    };

    let { data:results } = await this.searchers.search(Session.INTERNAL_PRIVILEGED, addressQuery);
    if (results.length === size) {
      throw new Error(`There are more tracked-ethereum-addresses than the system is configured to return (${size} addresses). Increase the max number of tracked addresses in 'params.addressIndexing.maxAddressesTracked' for data source configuration'.`);
    }

    let field = trackedAddressField === 'id' ? 'id' : `attributes.${trackedAddressField}`;
    let trackedAddresses = flatMap(results, i => get(i, field)).filter(i => Boolean(i)).map(i => i.toLowerCase());
    log.debug(`found tracked addresses for tracked address field '${trackedAddressContentType}.${field}': ${JSON.stringify(trackedAddresses)}`);
    return trackedAddresses;
  }

  async _getIndexedAddresses() {
    let size = get(this, 'addressIndexing.maxAddressesTracked') || DEFAULT_MAX_ADDRESSES_TRACKED;
    let { data: indexedAddresses } = await this.searchers.search(Session.INTERNAL_PRIVILEGED, {
      filter: { type: { exact: 'ethereum-addresses' } },
      page: { size }
    });

    return indexedAddresses.map(i => i.id.toLowerCase());
  }

  async _startTrackedAddressListening() {
    if (this._boundEventListeners) { return; }

    log.debug(`starting indexing event listeners for tracked addresses`);
    this._boundEventListeners = true;
    let trackedAddressContentType = get(this, 'addressIndexing.trackedAddressContentType');
    let trackedAddressField = get(this, 'addressIndexing.trackedAddressField');
    if (!trackedAddressContentType || !trackedAddressField) { return; }

    this.pgsearchClient.on('add', evt => {
      let { type } = evt;
      if (type !== trackedAddressContentType) { return; }

      this._eventProcessingPromise = Promise.resolve(this._eventProcessingPromise)
        .then(() => this._processIndexingAddEvent(trackedAddressField, evt));
    });

    this.pgsearchClient.on('delete', evt => {
      let { type } = evt;
      if (type !== trackedAddressContentType) { return; }

      this._eventProcessingPromise = Promise.resolve(this._eventProcessingPromise)
        .then(() => this._processIndexingDeleteEvent(trackedAddressField, evt));
    });

    log.debug(`completed setting up event listeners for tracked addresses`);
  }

  async _startNewBlockListening() {
    if (this._boundBlockListener) { return; }

    log.debug(`starting new block event listeners`);
    this._boundBlockListener = true;

    this.transactionIndex.on('blocks-indexed', evt => {
      log.debug(`Received blocks-indexed event: ${JSON.stringify(evt)}`);
      let { fromBlockHeight, toBlockHeight } = evt;
      // intentionally not awaiting as event handlers are synchronous in node make sure to use TransactionIndexer._indexingPromise in the tests so async doesn't leak
      this.index({ lastBlockHeight: fromBlockHeight, currentBlockNumber: toBlockHeight });
    });
  }

  async _processIndexingAddEvent(trackedAddressField, { doc: { data: trackedResource } }) {
    let field = trackedAddressField === 'id' ? 'id' : `attributes.${trackedAddressField}`;
    let fieldValue = get(trackedResource, field);
    if (!fieldValue) { return; }

    let addresses = (Array.isArray(fieldValue) ? fieldValue : [fieldValue]).map(i => i.toLowerCase());
    if (!addresses.length) { return; }

    let trackedAddressCounts = (await this._getTrackedAddresses()).reduce((totals, i) => {
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

    let deletedAddresses = difference(addresses, await this._getTrackedAddresses());
    if (deletedAddresses.length) {
      // intentionally not awaiting (indexing could take awhile), make sure to use TransactionIndexer._indexingPromise in the tests so async doesn't leak
      this.index({ stopIndexingAddresses: deletedAddresses });
    }
  }

  async _index(opts={}) {
    let {
      lastBlockHeight = 0,
      currentBlockNumber,
      stopIndexingAddresses,
      startIndexingAddresses,
      jobNumber
    } = opts;
    log.debug(`starting block index for index job #${jobNumber}: ${JSON.stringify(opts)}`);

    log.debug(`ensuring transaction-indexer has started`);
    await this._startedPromise;
    log.debug(`completed ensuring transaction-indexer has started`);

    if (Array.isArray(stopIndexingAddresses)) {
      await this._stopIndexingAddresses(stopIndexingAddresses);
      log.debug(`completed block index for index job #${jobNumber}`);
      return;
    }

    let trackedAddresses = startIndexingAddresses || await this._getTrackedAddresses();
    if (!trackedAddresses || !trackedAddresses.length) {
      log.info(`There are no tracked-ethereum-addresses to index.`);
      log.debug(`completed block index for index job #${jobNumber}`);
      return;
    }

    currentBlockNumber = currentBlockNumber || this.transactionIndex.blockHeight;
    let indexedAddresses = await this._getIndexedAddresses();
    let notYetIndexedAddresses = difference(trackedAddresses, indexedAddresses);
    let batch = this.pgsearchClient.beginBatch(await this.currentSchema.getSchema(), this.searchers);
    for (let address of notYetIndexedAddresses) {
      await this._prepopulateAddressResource(batch, address, currentBlockNumber);
    }
    await batch.done();

    batch = this.pgsearchClient.beginBatch(await this.currentSchema.getSchema(), this.searchers);
    for (let address of trackedAddresses) {
      let { data:newTransactions } = await this.searchers.search(Session.INTERNAL_PRIVILEGED, {
        filter: {
          or: [{
            type: { exact: 'ethereum-transactions' },
            'transaction-to': address.toLowerCase(),
            'block-number': { range: { gt: lastBlockHeight, lte: currentBlockNumber } }
          }, {
            type: { exact: 'ethereum-transactions' },
            'transaction-from': address.toLowerCase(),
            'block-number': { range: { gt: lastBlockHeight, lte: currentBlockNumber } }
          }]
        }
      });
      if (!newTransactions.length) {
        if (notYetIndexedAddresses.includes(address)) {
          await this._indexAddressResource(batch, address, currentBlockNumber);
        }
        continue;
      }

      let lastTransaction = newTransactions[newTransactions.length - 1];
      let addressVersion = `${get(lastTransaction, 'attributes.block-number')}.${get(lastTransaction, 'attributes.transaction-index')}`;
      if (!valid(coerce(addressVersion))) {
        throw new Error(`Cannot index address ${address} using its last transaction ${lastTransaction.id}, unable determine last transaction's position in the block (index). Reported transaction index is ${get(lastTransaction, 'attributes.transaction-index')}`);
      }
      await this._indexAddressResource(batch, address, currentBlockNumber, newTransactions, addressVersion);
    }
    await batch.done();
    log.debug(`completed block index for index job #${jobNumber}`);

    return currentBlockNumber;
  }

  async _stopIndexingAddresses(addresses) {
    if (!addresses || !addresses.length) { return; }

    let batch = this.pgsearchClient.beginBatch(await this.currentSchema.getSchema(), this.searchers);
    for (let address of addresses) {
      let document = await this.searchers.get(Session.INTERNAL_PRIVILEGED,
        'local-hub',
        'ethereum-addresses',
        address,
        ['transactions.from-address', 'transactions.to-address']);
      let { data: resource } = document;
      await batch.deleteDocument(await this._createDocumentContext(resource));
    }

    await batch.done();
  }

  async _prepopulateAddressResource(batch, address, blockHeight) {
    if (!address) { return; }

    let addressResource = {
      id: address.toLowerCase(),
      type: 'ethereum-addresses',
      attributes: {
        'ethereum-address': toChecksumAddress(address),
        'balance': (await this.ethereumClient.getBalance(address)).toString()
      },
      relationships: {
        transactions: { data: [] }
      },
      meta: {
        blockHeight,
        version: 0.0,
        loadingTransactions: true
      }
    };

    return await this._indexResource(batch, addressResource);
  }

  async _indexAddressResource(batch, address, blockHeight, transactions = [], addressVersion='0.0') {
    if (!address) { return; }
    log.trace(`indexing address ${address} at block #${blockHeight} with version ${addressVersion} and transactions${JSON.stringify(transactions)}`);

    let addressResource;
    try {
      addressResource = await this.searchers.get(Session.INTERNAL_PRIVILEGED, 'local-hub', 'ethereum-addresses', address.toLowerCase());
    } catch (err) {
      if (err.status !== 404) { throw err; }
    }
    if (addressResource) {
      addressResource = addressResource.data;
      let { meta: { version } } = addressResource;
      if (version && lt(coerce(addressVersion), coerce(version))) {
        throw new Error(`Cannot index ethereum-addresses/${address} the address version '${addressVersion}' is less than currently indexed address document version '${version}'. Address versions is dervied from '<blocknumber>.<highest txn index>'.`);
      }
    } else {
      addressResource = {
        id: address.toLowerCase(),
        type: 'ethereum-addresses',
        attributes: {
          'ethereum-address': toChecksumAddress(address),
        },
        relationships: {
          transactions: { data: [] }
        },
      };
    }

    let updatedTransactions = addressResource.relationships.transactions.data.concat((transactions || []).map(({ type, id }) => {
      return { type, id };
    }));

    addressResource.attributes.balance = (await this.ethereumClient.getBalance(address)).toString();
    addressResource.relationships.transactions.data = uniqBy(updatedTransactions, 'id');
    addressResource.meta = addressResource.meta || {};
    addressResource.meta.blockHeight = blockHeight;
    addressResource.meta.version = addressVersion;
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
    let schema = await this.currentSchema.getSchema();
    let contentType = schema.getType(type);
    let sourceId = contentType.dataSource.id;
    return this.searchers.createDocumentContext({
      id,
      type,
      schema,
      sourceId,
      upstreamDoc: { data: record }
    });
  }
});