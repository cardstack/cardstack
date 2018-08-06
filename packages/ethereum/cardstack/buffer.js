const Ember = require('ember-source/dist/ember.debug');
const { dasherize } = Ember.String;
const { pluralize } = require('inflection');
const { declareInjections } = require('@cardstack/di');
const DocumentContext = require('@cardstack/hub/indexing/document-context');
const Session = require('@cardstack/plugin-utils/session');
const log = require('@cardstack/logger')('cardstack/ethereum/buffer');
const { fieldTypeFor } = require('./abi-utils');

function attachMeta(model, meta) {
  model.meta = Object.assign(model.meta || {}, meta);
  return model;
}

module.exports = declareInjections({
  indexer: 'hub:indexers',
  searchers: 'hub:searchers',
  schema: 'hub:current-schema',
  pgsearchClient: `plugin-client:${require.resolve('@cardstack/pgsearch/client')}`
},

class EthereumBuffer {

  static create(...args) {
    return new this(...args);
  }

  constructor({ indexer, pgsearchClient, schema, searchers, }) {
    this.branches = null;
    this.ethereumService = null;
    this.indexer = indexer;
    this.searchers = searchers;
    this.schema = schema;
    this.pgsearchClient = pgsearchClient;
    this.contractDefinitions = {};
    this.contractName = null;
    this._flushedPromise = null;
    this._setupPromise = this._ensureClient();
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
  }

  indexModels(contractName, blockHeights, identifiers) {
    // we are intentionally not returning this promise, but rather save it for our tests to use
    this._flushedPromise = Promise.resolve(this._flushedPromise)
      .then(() => this._processRecords({contractName, blockHeights, identifiers }));
  }

  async shouldSkipIndexing(contractName, branch) {
    return await this.ethereumService.shouldSkipIndexing(contractName, branch);
  }

  async getBlockHeight(branch) {
    return await this.ethereumService.getBlockHeight(branch);
  }

  async _ensureClient() {
    await this.pgsearchClient.ensureDatabaseSetup();
  }

  async _indexRecord(batch, record) {
    log.debug(`indexing model in pgsearch ${JSON.stringify(record, null, 2)}`);
    let { id, type, meta: { branch }} = record;
    let schema = await this.schema.forBranch(branch);
    let contentType = schema.types.get(type);
    let sourceId = contentType.dataSource.id;
    let context = new DocumentContext({
      id,
      type,
      branch,
      schema,
      sourceId,
      upstreamDoc: { data: record },
      read: this._read(branch)
    });

    await batch.saveDocument(context);
  }

  _read(branch) {
    return async (type, id) => {
      let result;
      try {
        result = await this.searchers.get(Session.INTERNAL_PRIVILEGED, branch, type, id);
      } catch (err) {
        if (err.status !== 404) { throw err; }
      }

      if (result && result.data) {
        return result.data;
      }
    };
  }

  async _processRecords({ contractName, blockHeights, identifiers }) {
    log.debug(`processing records for ethereum with last indexed blockheights ${JSON.stringify(blockHeights)}, identifiers: ${JSON.stringify(identifiers, null, 2)}`);
    let contractDefinition = this.contractDefinitions[contractName];
    if (!contractDefinition) { return; }

    let batch = this.pgsearchClient.beginBatch();
    let contractIdentifiers = identifiers && identifiers.length ? identifiers.filter(identifier => identifier.isContractType) : [];
    if (!contractIdentifiers.length) {
      for (let branch of Object.keys(contractDefinition.addresses)) {
        let blockheight = await this.ethereumService.getBlockHeight(branch);
        await this._indexRecord(batch, attachMeta(await this.ethereumService.getContractInfo({ branch, contract: contractName }), { blockheight, branch, contractName }));
      }
    } else {
      for (let { branch, type } of contractIdentifiers) {
        let blockheight = await this.ethereumService.getBlockHeight(branch);
        await this._indexRecord(batch, attachMeta(await this.ethereumService.getContractInfo({ branch, type }), { blockheight, branch, contractName }));
      }
    }

    if (!identifiers || !identifiers.length) {
      log.info(`Retreving full history for contract ${contractName} address: ${JSON.stringify((contractDefinition.addresses))} since blockheight ${JSON.stringify(blockHeights)}`);
      identifiers = await this.ethereumService.getPastEventsAsHints(blockHeights);
    }

    for (let { id, branch, type, isContractType } of identifiers) {
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

      await this._indexRecord(batch, attachMeta(model, { blockheight, branch, contractName }));
    }

    await batch.done();

    log.debug(`completed issuing hub index jobs of buffered ethereum models with last indexed blockheights ${JSON.stringify(blockHeights)}`);
  }
});
