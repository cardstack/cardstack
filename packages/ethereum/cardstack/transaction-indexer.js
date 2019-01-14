const { declareInjections } = require('@cardstack/di');
const { difference, flatMap, uniqBy, intersection, get } = require('lodash');
const { utils: { BN, toChecksumAddress } } = require('web3');
const Session = require('@cardstack/plugin-utils/session');
const { coerce, valid, gt, lt } = require('semver');
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
    return flatMap(results, i => get(i, field)).filter(i => Boolean(i)).map(i => i.toLowerCase());
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
    if (currentBlockNumber === undefined) {
      // this can happen if there is a communication error with geth
      log.warn(`unable to obtain block number from ethereum client, skipping indexing`);
      return;
    }

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
    let oldestLastIndexedBlock = Object.keys(lastIndexedAddressesBlockHeights).length ?
      Object.keys(lastIndexedAddressesBlockHeights)
        .reduce((oldest, address) =>
          Math.min(oldest, Math.max(lastIndexedBlockHeight, lastIndexedAddressesBlockHeights[address])),
          currentBlockNumber) : 0;

    let newAddresses = trackedAddresses.filter(address => !lastIndexedAddressesBlockHeights[address]);
    let newAddressesInfo = {};
    let newAddressesThatAreFinished = [];
    if (newAddresses.length) {
      let batch = this.pgsearchClient.beginBatch(this.schema, this.searchers);
      for (let address of newAddresses) {
        let numSentTxns = await this.ethereumClient.getSentTransactionCount(address, currentBlockNumber);
        let balance = new BN(await this.ethereumClient.getBalance(address, currentBlockNumber));
        newAddressesInfo[address] = { numSentTxns, balance, discoveredAtBlock: currentBlockNumber };

        // First create the ethereum address so the client has something to look at while it
        // waits for the transactions to appear in the index, as transaction load may take awhile
        await this._prepopulateAddressResource(batch, address, currentBlockNumber);
      }
      await batch.done();
    }

    let discoveredTransactions = {};
    let addressesVersions = {};

    // Process new blocks that we haven't indexed yet (hub may have been turned off)
    let latestIndexedBlockNumber = await this._getLatestIndexedBlockNumber();
    if (latestIndexedBlockNumber != null && currentBlockNumber > latestIndexedBlockNumber) {
      let blockNumbersToProcess = Array.from({length: currentBlockNumber - latestIndexedBlockNumber}, (v, k) => k + latestIndexedBlockNumber + 1);
      await this._processBlocks({
        currentBlockNumber,
        oldestLastIndexedBlock,
        newAddressesInfo,
        trackedAddresses,
        lastIndexedAddressesBlockHeights,
        newAddresses,
        discoveredTransactions,
        addressesVersions,
        newAddressesThatAreFinished,
        blockNumbersToProcess
      });
    }

    // Use the blocks that we have indexed to see if the trackedAddress' transactions
    // appear within any indexed blocks--as this is much much faster than crawling incrementally
    // through all the blocks looking for transactions.
    let oldestIndexedBlockNumber = await this._getOldestIndexedBlockNumber();
    let { data:blocks } = await this.searchers.searchFromControllingBranch(Session.INTERNAL_PRIVILEGED, {
      filter: {
        type: { exact: 'blocks' },
        'transaction-participants': trackedAddresses
      },
      sort: '-block-number',
      page: { size: await this.getBlockHeight() }
    });

    if (blocks.length) {
      let blockNumbersToProcess = blocks.map(i => i.id);
      await this._processBlocks({
        currentBlockNumber,
        oldestLastIndexedBlock,
        newAddressesInfo,
        trackedAddresses,
        lastIndexedAddressesBlockHeights,
        newAddresses,
        discoveredTransactions,
        addressesVersions,
        newAddressesThatAreFinished,
        blockNumbersToProcess
      });
    }
    // Now index any stragglers that we missed from the blocks in our index. This will
    // trigger blocks to be added to our index via the searcher and the cache control we are using
    await this._processBlocks({
      currentBlockNumber,
      oldestLastIndexedBlock,
      newAddressesInfo,
      trackedAddresses,
      lastIndexedAddressesBlockHeights,
      newAddresses,
      discoveredTransactions,
      addressesVersions,
      newAddressesThatAreFinished,
      startProcessingFromBlock: oldestIndexedBlockNumber
    });
    log.debug(`====> newAddressesThatAreFinished at the concolusion of of '_indexBlocks()': ${JSON.stringify(newAddressesThatAreFinished)}`);

    let batch = this.pgsearchClient.beginBatch(this.schema, this.searchers);
    let addressesWithTransactions = Object.keys(discoveredTransactions);
    for (let address of addressesWithTransactions) {
      await this._indexAddressResource(batch, address, currentBlockNumber, discoveredTransactions[address], addressesVersions[address], get(newAddressesInfo, `${address}.discoveredAtBlock`));
    }


    log.debug(`====> ready to write out addresses that have no transactions after processing all the blocks. discovered transactions: ${JSON.stringify(discoveredTransactions)}, new address info: ${JSON.stringify(this.displayableAddressesInfo(newAddressesInfo))}`);
    let newAddressesWithoutTransactions = newAddresses.filter(address => !newAddressesThatAreFinished.includes(address) &&
                                                                         !addressesWithTransactions.includes(address));
    for (let address of newAddressesWithoutTransactions) {
      await this._indexAddressResource(batch, address, currentBlockNumber, undefined, undefined, get(newAddressesInfo, `${address}.discoveredAtBlock`));
    }
    await batch.done();
  }

  async _processBlocks({
    currentBlockNumber,
    oldestLastIndexedBlock,
    newAddressesInfo,
    trackedAddresses,
    lastIndexedAddressesBlockHeights,
    newAddresses,
    discoveredTransactions,
    addressesVersions,
    newAddressesThatAreFinished,
    blockNumbersToProcess,
    startProcessingFromBlock
  }) {
    if (blockNumbersToProcess) {
      for (let blockNumber of blockNumbersToProcess) {
        await this._processBlockWithIncrementalAddressIndexing({
          trackedAddresses,
          lastIndexedAddressesBlockHeights,
          newAddresses,
          newAddressesInfo,
          blockNumber,
          discoveredTransactions,
          addressesVersions,
          currentBlockNumber,
          newAddressesThatAreFinished
        });
      }
    } else {
      // Using the number of sent transactions and the balance as a heuristic to prevent having to crawl to
      // the genesis block when looking for transactions for an address. Using the available information about
      // the current state (number of "from" transactions and the current balance), it goes back in time until
      // at least so many "from" transactions have been found, and then continues going back until the balance
      // reaches 0. The inherent limitation is that 0-value transactions before the account was funded will not
      // be found. These sorts of transactions are indicative of interacting with a smart contract, for which
      // it's probably better suited to use this plugin's contract indexing for these types of transactions.
      startProcessingFromBlock = startProcessingFromBlock != null ? startProcessingFromBlock : currentBlockNumber;
      for (let blockNumber = startProcessingFromBlock;
        blockNumber >= 0 &&
        ((oldestLastIndexedBlock && blockNumber > oldestLastIndexedBlock) ||
          hasBalance(newAddressesInfo) ||
          hasSentTxns(newAddressesInfo));
        blockNumber--) {

        await this._processBlockWithIncrementalAddressIndexing({
          trackedAddresses,
          lastIndexedAddressesBlockHeights,
          newAddresses,
          newAddressesInfo,
          blockNumber,
          discoveredTransactions,
          addressesVersions,
          currentBlockNumber,
          newAddressesThatAreFinished
        });
        if (blockNumber === 0 &&
          (hasBalance(newAddressesInfo) || hasSentTxns(newAddressesInfo))) {
          let addressesWithBalances = Object.keys(newAddressesInfo).filter(address => newAddressesInfo[address].balance.gt(new BN(0)));
          let addressesWithSentTransactions = Object.keys(newAddressesInfo).filter(address => newAddressesInfo[address].numSentTxns > 0);
          throw new Error(`Error: the heuristic used to index the ethereum address has reached the genesis block and was unable to reach succesful end state. This should never happen and indicates a bug in our heuristic calcuation.
 These addresses still have an unresolved balances: ${JSON.stringify(addressesWithBalances)}. These addresses still have unresolved sent transactions: ${JSON.stringify(addressesWithSentTransactions)}`);
        }
      }
    }
    log.debug(`====> newAddressesThatAreFinished at the end of '_processBlocks()': ${JSON.stringify(newAddressesThatAreFinished)}`);
  }

  async _processBlockWithIncrementalAddressIndexing({
    trackedAddresses,
    lastIndexedAddressesBlockHeights,
    newAddresses,
    newAddressesInfo,
    blockNumber,
    discoveredTransactions,
    addressesVersions,
    currentBlockNumber,
    newAddressesThatAreFinished
  }) {
    let batch = this.pgsearchClient.beginBatch(this.schema, this.searchers);
    await this._processBlock({
      trackedAddresses,
      lastIndexedAddressesBlockHeights,
      newAddresses,
      newAddressesInfo,
      blockNumber,
      batch,
      discoveredTransactions,
      addressesVersions
    });

    let newlyFinishedAddresses = difference(finishedAddresses(newAddressesInfo), newAddressesThatAreFinished);
    for (let address of newlyFinishedAddresses) {
      if (discoveredTransactions[address]) {
        await this._indexAddressResource(batch, address, currentBlockNumber, discoveredTransactions[address], addressesVersions[address], get(newAddressesInfo, `${address}.discoveredAtBlock`));
      } else {
        await this._indexAddressResource(batch, address, currentBlockNumber, undefined, undefined, get(newAddressesInfo, `${address}.discoveredAtBlock`));

      }
      delete discoveredTransactions[address];
    }

    // TODO write indexing progess to new addresses that are not finished every X amount of blocks

    await batch.done();
    for (let address of newlyFinishedAddresses) {
      newAddressesThatAreFinished.push(address); // using Array.concat is problematic as we are relying on the array to mutate, not be reassigned
    }
    log.debug(`====> finished indexing addresses ${JSON.stringify(newlyFinishedAddresses)} at block ${blockNumber}. newAddressesThatAreFinished: ${JSON.stringify(newAddressesThatAreFinished)}`);
  }

  async _indexBlock(trackedAddresses, blockNumber) {
    let discoveredTransactions = {};
    let addressesVersions = {};
    let lastIndexedAddressesBlockHeights = lastIndexedBlockHeights(await this._getIndexedAddresses());

    let batch = this.pgsearchClient.beginBatch(this.schema, this.searchers);
    await this._processBlock({
      trackedAddresses,
      blockNumber,
      batch,
      lastIndexedAddressesBlockHeights,
      discoveredTransactions,
      addressesVersions
    });

    for (let address of Object.keys(discoveredTransactions)) {
      await this._indexAddressResource(batch, address, blockNumber, discoveredTransactions[address], addressesVersions[address]);
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
    addressesVersions }) {
    log.debug(`processing block #${blockNumber} for transactions that include tracked ethereum addresses`);
    let { data: { attributes: { 'block-data': block } } } = await this.searchers.getFromControllingBranch(Session.INTERNAL_PRIVILEGED, 'blocks', blockNumber);
    // log.debug(`transactions in block #${blockNumber}: ${JSON.stringify(block.transactions, null, 2)}`);
    if (!block || !block.transactions.length) { return; }

    let addressesEligibleForIndexing = trackedAddresses.filter(address =>
      (lastIndexedAddressesBlockHeights[address] && lastIndexedAddressesBlockHeights[address] < blockNumber) ||
      (newAddressesInfo[address] && newAddressesInfo[address].balance.gt(new BN(0))) ||
      (newAddressesInfo[address] && newAddressesInfo[address].numSentTxns > 0));
    for (let transaction of block.transactions) {
      let addressesToIndex = intersection(addressesEligibleForIndexing, [transaction.from.toLowerCase(), (transaction.to || '').toLowerCase()]);
      if (!addressesToIndex.length) { continue; }

      let transactionResource;
      try {
        let existingTransaction = await this.searchers.getFromControllingBranch(Session.INTERNAL_PRIVILEGED, 'ethereum-transactions', transaction.hash);
        transactionResource = existingTransaction.data;
      } catch (e) {
        if (e.status === 404) {
          log.debug(`index of ethereum transactions found transaction to index at block ${blockNumber}`);
          log.trace(`found transaction to index at block ${blockNumber} is: ${JSON.stringify(transaction, null, 2)}`);
          transactionResource = await this._indexTransactionResource(batch, block, transaction);
        } else { throw e; }
      }
      let isSuccessfulTxn = transactionResource && get(transactionResource, 'attributes.transaction-successful');

      for (let address of addressesToIndex) {
        discoveredTransactions[address] = discoveredTransactions[address] || [];
        discoveredTransactions[address].unshift(transaction.hash);
        let currentVersion = addressesVersions[address];
        let discoveredVersion = `${blockNumber}.${get(transactionResource, 'attributes.transaction-index')}`;
        if (valid(discoveredVersion)) {
          throw new Error(`Cannot process transaction ${transaction.hash}, unable determine transaction's position in the block (index). Reported transaction index is ${get(transactionResource, 'attributes.transaction-index')}`);
        }
        addressesVersions[address] = currentVersion && gt(coerce(currentVersion), coerce(discoveredVersion)) ?
                                     currentVersion : discoveredVersion;
        if (newAddressesInfo[address]) {
          newAddressesInfo[address].discoveredAtBlock = Math.min(blockNumber, newAddressesInfo[address].discoveredAtBlock);
        }
      }

      if (isSuccessfulTxn && newAddresses.includes(transaction.from.toLowerCase())) {
        log.debug(`====> discovered transaction for 'from' address ${transaction.from} at block ${blockNumber}. trnsaction value: ${transaction.value} current address info: ${JSON.stringify(this.displayableAddressesInfo(newAddressesInfo)[transaction.from.toLowerCase()])}`);
        let balance = newAddressesInfo[transaction.from.toLowerCase()].balance;
        let gasCost = transactionResource ?
          (new BN(get(transactionResource, 'attributes.gas-used') || 0))
            .mul((new BN(get(transactionResource, 'attributes.gas-price') || 0))) :
          new BN(0);
        newAddressesInfo[transaction.from.toLowerCase()].balance = balance.add(new BN(transaction.value)).add(gasCost);
        newAddressesInfo[transaction.from.toLowerCase()].numSentTxns--;
        log.debug(`====> discovered transaction for 'from' address ${transaction.from} at block ${blockNumber}. updated address info: ${JSON.stringify(this.displayableAddressesInfo(newAddressesInfo)[transaction.from.toLowerCase()])}`);
      }

      if (isSuccessfulTxn && transaction.to && newAddresses.includes(transaction.to.toLowerCase())) {
        log.debug(`====> discovered transaction for 'to' address ${transaction.to} at block ${blockNumber}. trnsaction value: ${transaction.value} current address info: ${JSON.stringify(this.displayableAddressesInfo(newAddressesInfo)[transaction.to.toLowerCase()])}`);
        let balance = newAddressesInfo[transaction.to.toLowerCase()].balance;
        newAddressesInfo[transaction.to.toLowerCase()].balance = balance.sub(new BN(transaction.value));
        if (newAddressesInfo[transaction.to.toLowerCase()].balance.isNeg()) {
          throw new Error(`Error: the heuristic used to index the ethereum address ${transaction.to} resulted in a negative balance at block #${blockNumber} for transaction hash ${transaction.hash}. This should never happen and indicates a bug in our heuristic calculation.`);
        }
        log.debug(`====> discovered transaction for 'to' address ${transaction.to} at block ${blockNumber}. updated address info: ${JSON.stringify(this.displayableAddressesInfo(newAddressesInfo)[transaction.to.toLowerCase()])}`);
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
        version: 0.0,
        loadingTransactions: true
      }
    };

    return await this._indexResource(batch, addressResource);
  }

  async _indexAddressResource(batch, address, blockHeight, transactions = [], addressVersion='0.0', discoveredAtBlock) {
    if (!address) { return; }
    log.debug(`indexing address ${address} at block #${blockHeight} with version ${addressVersion} and transactions${JSON.stringify(transactions)}`);

    let addressResource;
    try {
      addressResource = await this.searchers.getFromControllingBranch(Session.INTERNAL_PRIVILEGED, 'ethereum-addresses', address.toLowerCase());
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
          'ethereum-address': toChecksumAddress(address)
        },
        relationships: {
          transactions: { data: [] }
        },
      };
    }

    addressResource.attributes['balance'] = (await this.ethereumClient.getBalance(address, blockHeight)).toString();
    let updatedTransactions = addressResource.relationships.transactions.data.concat((transactions || []).map(txn => {
      return { type: 'ethereum-transactions', id: txn };
    }));

    addressResource.relationships.transactions.data = uniqBy(updatedTransactions, 'id');
    addressResource.meta = addressResource.meta || {};
    addressResource.meta.blockHeight = blockHeight;
    addressResource.meta.version = addressVersion;
    addressResource.meta.loadingTransactions = undefined;
    addressResource.meta.discoveredAtBlock = Math.min(addressResource.meta.discoveredAtBlock || blockHeight, discoveredAtBlock || blockHeight);

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

  async _getOldestIndexedBlockNumber() {
    let { data: blocks } = await this.searchers.searchFromControllingBranch(Session.INTERNAL_PRIVILEGED, {
      filter: {
        type: { exact: 'blocks' }
      },
      sort: 'block-number',
      page: { size: 1 }
    });

    if (!blocks.length) { return; }

    return get(blocks, '[0].attributes.block-number');
  }
  async _getLatestIndexedBlockNumber() {
    let { data: blocks } = await this.searchers.searchFromControllingBranch(Session.INTERNAL_PRIVILEGED, {
      filter: {
        type: { exact: 'blocks' }
      },
      sort: '-block-number',
      page: { size: 1 }
    });

    if (!blocks.length) { return; }

    return get(blocks, '[0].attributes.block-number');
  }

  displayableAddressesInfo(addressesInfo) {
    let displayableInfo = require('lodash').merge({}, addressesInfo);
    for (let address of Object.keys(addressesInfo)) {
      displayableInfo[address].balance = displayableInfo[address].balance.toString();
    }
    return displayableInfo;
  }
});

function hasBalance(addressesInfo) {
  let balances = Object.keys(addressesInfo).map(address => addressesInfo[address].balance);
  return balances.some(b => b.gt(new BN(0)));
}

function hasSentTxns(addressesInfo) {
  let numSentTxns = Object.keys(addressesInfo).map(address => addressesInfo[address].numSentTxns);
  return numSentTxns.some(n => n > 0);
}

function finishedAddresses(addressesInfo) {
  let noSentTxns = Object.keys(addressesInfo).filter(address => addressesInfo[address].numSentTxns === 0);
  let noBalance =  Object.keys(addressesInfo).filter(address => addressesInfo[address].balance.isZero());
  return intersection(noSentTxns, noBalance);
}

function lastIndexedBlockHeights(indexedAddresses) {
  let lastIndexedAddressesBlockHeights = {};
  for (let address of indexedAddresses) {
    lastIndexedAddressesBlockHeights[address.id.toLowerCase()] = get(address, 'meta.blockHeight');
  }
  return lastIndexedAddressesBlockHeights;
}
