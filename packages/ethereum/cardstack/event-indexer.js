const Ember = require('ember-source/dist/ember.debug');
const { dasherize } = Ember.String;
const { pluralize } = require('inflection');
const { declareInjections } = require('@cardstack/di');
const DocumentContext = require('@cardstack/hub/indexing/document-context');
const Session = require('@cardstack/plugin-utils/session');
const log = require('@cardstack/logger')('cardstack/ethereum/event-indexer');
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

class EthereumEventIndexer {

  static create(...args) {
    return new this(...args);
  }

  constructor({ indexer, pgsearchClient, schema, searchers, }) {
    this.ethereumClient = null;
    this.indexer = indexer;
    this.searchers = searchers;
    this.schema = schema;
    this.pgsearchClient = pgsearchClient;
    this.contractDefinitions = {};
    this.contractName = null;
    this._indexingPromise = null; // this is exposed to the tests as web3 has poor support for async in event handlers
    this._setupPromise = this._ensureClient();
  }

  async start({ name, contract, ethereumClient }) {
    await this._setupPromise;

    this.contractDefinitions[name] = contract;
    this.ethereumClient = ethereumClient;

    await this.ethereumClient.start({ name, contract, eventIndexer: this });
  }

  async index(contractName, blockHeights, history) {
    this._indexingPromise = Promise.resolve(this._indexingPromise)
      .then(() => this._processRecords({contractName, blockHeights, history }));

    await this._indexingPromise;
  }

  async shouldSkipIndexing(contractName, branch) {
    return await this.ethereumClient.shouldSkipIndexing(contractName, branch);
  }

  async getBlockHeight(branch) {
    return await this.ethereumClient.getBlockHeight(branch);
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

  async _processRecords({ contractName, blockHeights, history }) {
    log.debug(`processing records for ethereum with last indexed blockheights ${JSON.stringify(blockHeights)}, history: ${JSON.stringify(history, null, 2)}`);
    let contractDefinition = this.contractDefinitions[contractName];
    if (!contractDefinition) { return; }

    let batch = this.pgsearchClient.beginBatch();

    for (let branch of Object.keys(contractDefinition.addresses)) {
      let blockheight = await this.ethereumClient.getBlockHeight(branch);
      await this._indexRecord(batch, attachMeta(await this.ethereumClient.getContractInfo({ branch, contract: contractName }), { blockheight, branch, contractName }));
    }

    if (!history || !history.length) {
      log.info(`Retreving full history for contract ${contractName} address: ${JSON.stringify((contractDefinition.addresses))} since blockheight ${JSON.stringify(blockHeights)}`);
      history = await this.ethereumClient.getContractHistorySince(blockHeights);
    }

    for (let { branch, event, identifiers } of history) {
      let contractAddress = contractDefinition.addresses[branch];

      let eventModel = event ? generateEventModel(contractName, contractAddress, event) : null;
      if (eventModel) {
        let blockheight = await this.ethereumClient.getBlockHeight(branch);
        await this._indexRecord(batch, attachMeta(eventModel, { blockheight, branch, contractName }));

        if (!contractDefinition.eventContentTriggers[eventModel.attributes['event-name']].length) {
          let contract = await this._read(branch)(pluralize(contractName), contractAddress);
          if (!contract) {
            log.error(`Cannot find contract ${pluralize(contractName)}/${contractAddress} from index when trying to associate event to contract ${JSON.stringify(eventModel)}`);
            continue;
          }

          addEventRelationship(contract, eventModel);
          let blockheight = await this.ethereumClient.getBlockHeight(branch);
          await this._indexRecord(batch, attachMeta(contract, { blockheight, branch, contractName }));
        }
      }

      if (!identifiers) { continue; }

      for (let { id, type, isContractType } of identifiers) {
        if (!branch || !type || !id || isContractType) { continue; }

        let contractAddress = contractDefinition.addresses[branch];
        let blockheight = await this.ethereumClient.getBlockHeight(branch);
        let { data, methodName } = await this.ethereumClient.getContractInfoForIdentifier({ id, type, branch, contractName });
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

        let existingRecord = await this._read(branch)(type, id.toLowerCase());
        if (existingRecord) {
          model.relationships = existingRecord.relationships;
        } else {
          model.relationships[`${contractName}-contract`] = {
            data: { id: contractAddress, type: pluralize(contractName) }
          };
        }

        if (eventModel) {
          addEventRelationship(model, eventModel);
        }

        await this._indexRecord(batch, attachMeta(model, { blockheight, branch, contractName }));
      }
    }

    await batch.done();

    log.debug(`completed indexing ethereum models with last indexed blockheights ${JSON.stringify(blockHeights)}`);
  }
});

function addEventRelationship(model, event) {
  if (!model.relationships) {
    model.relationships = {};
  }

  let eventRelationships = model.relationships[event.type];
  if (!eventRelationships || !eventRelationships.data || !Array.isArray(eventRelationships.data)) {
    eventRelationships = { data: [] };
    model.relationships[event.type] = eventRelationships;
  }

  if (!eventRelationships.data.find(r => r.id === event.id && r.type === event.type)) {
    eventRelationships.data.push({ type: event.type, id: event.id });
  }
}

function generateEventModel(contractName, contractAddress, event) {
  let attributes = {};
  let eventArgs = Object.keys(event.returnValues || {}).filter(key => key.match(/^\D.*/));

  for (let field of eventArgs) {
    attributes[`${dasherize(event.event)}-event-${dasherize(field.replace(/^_/, ''))}`] = event.returnValues[field];
  }
  attributes['event-name'] = event.event;
  attributes['block-number'] = event.blockNumber;
  attributes['transaction-id'] = event.transactionHash;

  return {
    id: `${event.transactionHash}_${event.logIndex}`,
    type: `${contractName}-${dasherize(event.event)}-events`,
    attributes,
    relationships: {
      [`${contractName}-contract`]: {
        data: { id: contractAddress, type: `${pluralize(contractName)}` }
      }
    }
  };
}
