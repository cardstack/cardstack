const ElasticAssert = require('@cardstack/elasticsearch/test-support');
const Client = require('@cardstack/elasticsearch/client');
const Ember = require('ember-source/dist/ember.debug');
const { dasherize } = Ember.String;
const { pluralize } = require('inflection');
const { get, groupBy, orderBy } = require('lodash');
const { declareInjections } = require('@cardstack/di');
const log = require('@cardstack/logger')('cardstack/ethereum/buffer');
const { fieldTypeFor } = require('./abi-utils');

const indexPrefix = 'ethereum_buffer';

function attachMeta(model, meta) {
  model.meta = Object.assign(model.meta || {}, meta);
  return model;
}

function collapseBufferedHints(hints) {
  let groupedHints = groupBy(hints, ({ id, type }) => type + '_' + id); // not taking branch into consideration, as address collisions across networks is astronomically remote
  return Object.keys(groupedHints).map(key => {
    let hintsForAddress = orderBy(groupedHints[key], ['blockheight'], ['desc']);
    return hintsForAddress[0];
  });
}

module.exports = declareInjections({
  indexer: 'hub:indexers',
  pgsearchClient: `plugin-client:${require.resolve('@cardstack/pgsearch/client')}`
},

class EthereumBuffer {

  static create(...args) {
    return new this(...args);
  }

  constructor({ indexer, pgsearchClient }) {
    this.branches = null;
    this.ethereumService = null;
    this.indexer = indexer;
    this.pgsearchClient = pgsearchClient;
    this.client = null;
    this.contractDefinitions = {};
    this.contractName = null;
    this._flushedPromise = null;
    this._bufferedRecordIndexingPromise = null;
    this._setupPromise = this._ensureClient();
    this._processingHints = [];
    this.bulkOps = null;
  }

  async start({ name, contract, branches, ethereumService }) {
    await this._setupPromise;

    this.contractDefinitions[name] = contract;
    this.branches = branches;
    this.ethereumService = ethereumService;

    await this.ethereumService.start({ name, contract, buffer: this });
  }

  async flush() {
    await this._flushedPromise;
    await this._bufferedRecordIndexingPromise;
  }

  loadModels(contractName, blockHeights, hints) {
    // we are intentionally not returning this promise, but rather save it for our tests to use
    this._flushedPromise = Promise.resolve(this._flushedPromise)
      .then(() => this._processHints({contractName, blockHeights, hints }));
  }

  async shouldSkipIndexing(contractName, branch) {
    return await this.ethereumService.shouldSkipIndexing(contractName, branch);
  }

  async readModels(contractName, blockHeights, hints) {
    let bufferedModels = [];
    let unbufferedHints = [];

    if (!hints) {
      this.loadModels(contractName, blockHeights, null);
      return [];
    }

    for (let hint of hints) {
      let { id, type } = hint;
      let bufferedModel;
      try {
        bufferedModel = await this.client.es.get({
          index: this.index,
          type,
          id
        }).then(resp => resp._source);
      } catch (err) {
        // not found is ok, that just means we need to trigger the load of the model
        if (err.status !== 404) { throw err; }
      }

      let modelBranch = get(bufferedModel, 'meta.branch');
      let modelBlockheight = get(bufferedModel, 'meta.blockheight');
      if (modelBranch &&
          modelBlockheight &&
          (!blockHeights[modelBranch] ||
           modelBlockheight >= blockHeights[modelBranch])) {
        bufferedModels.push(bufferedModel);
      } else if (this._processingHints && !this._processingHints.find(h => h.id === id && h.type === type)) {
        unbufferedHints.push(hint);
      }
    }

    if (unbufferedHints.length) {
      this.loadModels(contractName, blockHeights, unbufferedHints);
    }

    return bufferedModels;
  }

  async _ensureClient() {
    await this.pgsearchClient.ensureDatabaseSetup();

    if (!this.client) {
      this.client = await Client.create();
    }

    await this._ensureIndex();
  }

  async _ensureIndex() {
    let ea = new ElasticAssert();
    let indices = await ea.indices();
    let index = indices.find(i => i.indexOf(`${Client.branchPrefix}_${indexPrefix}_`) > -1);

    if (!index) {
      index = `${Client.branchPrefix}_${indexPrefix}_` + require('crypto').randomBytes(16).toString('base64').replace(/\W+/g, '').toLowerCase();
      await this.client.es.indices.create({ index });
    }

    this.index = index;
  }

  async _bufferRecord(record) {
    log.debug(`indexing model in elasticsearch buffer ${JSON.stringify(record, null, 2)}`);
    await this.bulkOps.add({
      index: {
        _index: this.index,
        _type: record.type,
        _id: record.id
      }
    }, record);

    return {
      type: record.type,
      id: record.id,
      branch: record.meta.branch
    };
  }

  async _processHints({ contractName, blockHeights, hints }) {
    log.debug(`processing hints for ethereum with last indexed blockheights ${JSON.stringify(blockHeights)}, hinst: ${JSON.stringify(hints, null, 2)}`);
    this.bulkOps = this.client.bulkOps({});
    this._processingHints = hints;
    let contractDefinition = this.contractDefinitions[contractName];
    if (!contractDefinition) { return; }
    let bufferedHints = [];

    let contractHints = hints && hints.length ? hints.filter(hint => hint.isContractType) : [];
    if (!contractHints.length) {
      for (let branch of Object.keys(contractDefinition.addresses)) {
        let blockheight = await this.ethereumService.getBlockHeight(branch);
        bufferedHints.push(await this._bufferRecord(attachMeta(await this.ethereumService.getContractInfo({ branch, contract: contractName }), { blockheight, branch, contractName })));
      }
    } else {
      for (let { branch, type } of contractHints) {
        let blockheight = await this.ethereumService.getBlockHeight(branch);
        bufferedHints.push(await this._bufferRecord(attachMeta(await this.ethereumService.getContractInfo({ branch, type }), { blockheight, branch, contractName })));
      }
    }

    if (!hints || !hints.length) {
      log.info(`Retreving full history for contract ${contractName} address: ${JSON.stringify((contractDefinition.addresses))} since blockheight ${JSON.stringify(blockHeights)}`);
      hints = await this.ethereumService.getPastEventsAsHints(blockHeights);
    }

    for (let { id, branch, type, isContractType } of hints) {
      if (!branch || !type || !id || isContractType) { continue; }

      let contractAddress = contractDefinition.addresses[branch];
      let blockheight = await this.ethereumService.getBlockHeight(branch);
      let { data, methodName } = await this.ethereumService.getContractInfoFromHint({ id, type, branch, contractName });
      let methodAbiEntry = contractDefinition["abi"].find(item => item.type === 'function' &&
        item.constant &&
        item.name === methodName);
      let fieldInfo = fieldTypeFor(contractName, methodAbiEntry);
      if (!fieldInfo) { continue; }

      let { isMapping, fields } = fieldInfo;
      if (!isMapping || !fields.length) { continue; }

      let model = {
        id: id.toLowerCase(),
        type,
        attributes: {
          'ethereum-address': id // preserve the case of the ID here to faithfully represent EIP-55 encoding
        },
        relationships: {}
      };

      if (typeof data === "object") {
        for (let returnName of Object.keys(data)) {
          let fieldName = `${dasherize(methodName)}-${dasherize(returnName)}`;
          if (!fields.find(field => field.name === fieldName)) { continue; }
          model.attributes[fieldName] = data[returnName];
        }
      } else {
        model.attributes[fields[0].name] = data;
      }

      model.relationships[`${contractName}-contract`] = {
        data: { id: contractAddress, type: pluralize(contractName) }
      };

      bufferedHints.push(await this._bufferRecord(attachMeta(model, { blockheight, branch, contractName })));
    }

    log.debug(`finalizing bulk ops for buffered index update with last indexed blockheights ${JSON.stringify(blockHeights)}`);
    await this.bulkOps.finalize();

    log.debug(`starting hub index of buffered ethereum models with last indexed blockheights ${JSON.stringify(blockHeights)}`);
    // dont await this promise as these indexing jobs will be blocked on the indexing job that kicked off this buffered load. save this promise for testing purposes
    let indexJob = this.indexer.update({ hints: collapseBufferedHints(bufferedHints) });
    this._bufferedRecordIndexingPromise = Promise.resolve(this._bufferedRecordIndexingPromise).then(() => indexJob);

    log.debug(`completed issuing hub index jobs of buffered ethereum models with last indexed blockheights ${JSON.stringify(blockHeights)}`);


    this._processingHints = [];
  }
});
