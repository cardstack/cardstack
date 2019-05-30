const Ember = require('ember-source/dist/ember.debug');
const { dasherize } = Ember.String;
const { pluralize } = require('inflection');
const { declareInjections } = require('@cardstack/di');
const Session = require('@cardstack/plugin-utils/session');
const log = require('@cardstack/logger')('cardstack/ethereum/event-indexer');
const { fieldTypeFor } = require('./abi-utils');
const { get } = require('lodash');

function attachMeta(model, meta) {
  model.meta = Object.assign(model.meta || {}, meta);
  return model;
}

module.exports = declareInjections({
  indexer: 'hub:indexers',
  searchers: 'hub:searchers',
  currentSchema: 'hub:current-schema',
  pgsearchClient: `plugin-client:${require.resolve('@cardstack/pgsearch/client')}`
},

class EthereumEventIndexer {

  static create(...args) {
    return new this(...args);
  }

  constructor({ indexer, pgsearchClient, currentSchema, searchers }) {
    this.ethereumClient = null;
    this.indexer = indexer;
    this.searchers = searchers;
    this.currentSchema = currentSchema;
    this.pgsearchClient = pgsearchClient;
    this.contractDefinitions = {};
    this.contractName = null;
    this._indexingPromise = null; // this is exposed to the tests as web3 has poor support for async in event handlers
  }

  async start({ name, contract, ethereumClient }) {
    await this.pgsearchClient.ensureDatabaseSetup();

    this.contractDefinitions[name] = contract;
    this.ethereumClient = ethereumClient;

    await this.ethereumClient.startEventListening({ name, contract, eventIndexer: this });
  }

  async index(contractName, blockHeight, history) {
    this._indexingPromise = Promise.resolve(this._indexingPromise)
      .then(() => this._processRecords({contractName, blockHeight, history }));

    await this._indexingPromise;
  }

  async shouldSkipIndexing(contractName) {
    return await this.ethereumClient.shouldSkipIndexing(contractName);
  }

  async getBlockHeight() {
    return await this.ethereumClient.getBlockHeight();
  }

  async _indexRecord(batch, record) {
    log.debug('indexing model in pgsearch %j', record);
    let { id, type } = record;
    let schema = await this.currentSchema.getSchema();
    let contentType = schema.types.get(type);
    let sourceId = contentType.dataSource.id;
    let context = this.searchers.createDocumentContext({
      id,
      type,
      schema,
      sourceId,
      upstreamDoc: { data: record }
    });

    await batch.saveDocument(context);
  }

  _getContractNameForEvent(event) {
    let eventAddress = event.address;
    for (let contractName of Object.keys(this.contractDefinitions)) {
      let contractAddress = get(this.contractDefinitions, `${contractName}.address`);
      if (contractAddress.toLowerCase() === eventAddress.toLowerCase()) {
        return contractName;
      }
    }
  }

  async _processRecords({ contractName, blockHeight, history }) {
    log.debug('processing records for ethereum with last indexed blockheight %j, history: %j', blockHeight, history);
    let contractDefinition = this.contractDefinitions[contractName];
    if (!contractDefinition) { return; }

    let batch = this.pgsearchClient.beginBatch(this.currentSchema, this.searchers);

    let blockheight = await this.ethereumClient.getBlockHeight();
    await this._indexRecord(batch, attachMeta(await this.ethereumClient.getContractInfo({ contract: contractName }), { blockheight, contractName }));

    if (!history || !history.length) {
      log.info(`Retreving full history for contract ${contractName} address: ${JSON.stringify((contractDefinition.addresses))} since blockheight ${blockHeight}`);
      history = await this.ethereumClient.getContractHistorySince(blockHeight);
    }

    for (let { event, identifiers } of history) {
      // The history includes the combined events from all contracts--need to get the specific contract context for the event
      let contractNameForEvent = this._getContractNameForEvent(event);
      if (!contractNameForEvent) { continue; }

      let contractDefinitionForEvent = this.contractDefinitions[contractNameForEvent];
      let contractAddress = contractDefinitionForEvent.address;

      let eventModel = event ? generateEventModel(contractNameForEvent, contractAddress, event) : null;
      if (eventModel) {
        let blockheight = await this.ethereumClient.getBlockHeight();
        await this._indexRecord(batch, attachMeta(eventModel, { blockheight, contractNameForEvent }));

        if (!contractDefinitionForEvent.eventContentTriggers[eventModel.attributes['event-name']].length) {
          let contract;
          try {
            contract = (await this.searchers.getResourceAndMeta(Session.INTERNAL_PRIVILEGED, pluralize(contractNameForEvent), contractAddress)).resource;
          } catch (err) {
            if (err.status !== 404) { throw err; }
          }
          if (!contract) {
            log.error(`Cannot find contract ${pluralize(contractNameForEvent)}/${contractAddress} from index when trying to associate event to contract ${JSON.stringify(eventModel)}`);
            continue;
          }

          addEventRelationship(contract, eventModel);
          let blockheight = await this.ethereumClient.getBlockHeight();
          await this._indexRecord(batch, attachMeta(contract, { blockheight, contractNameForEvent }));
        }
      }

      if (!identifiers) { continue; }

      for (let { id, type, isContractType, idEthereumType } of identifiers) {
        if (!type || !id || isContractType) { continue; }

        let contractAddress = contractDefinition.address;
        let blockheight = await this.ethereumClient.getBlockHeight();
        let methodName = this.ethereumClient.contentTypeToContractMethod(type, contractName);
        let methodAbiEntry = contractDefinition["abi"].find(item => item.type === 'function' &&
          item.constant &&
          item.name === methodName);
        let fieldInfo = fieldTypeFor(contractName, methodAbiEntry);
        if (!fieldInfo) { continue; }

        let { isMapping, fields, mappingKeyType } = fieldInfo;
        if (!isMapping || !fields.length || mappingKeyType !== idEthereumType) { continue; }

        let { data } = await this.ethereumClient.getContractInfoForIdentifier({ id, type, contractName });
        let model = {
          id: id.toLowerCase(),
          type,
          attributes: {},
          relationships: {}
        };

        if (mappingKeyType === 'address') {
          model.attributes['ethereum-address'] = id; // preserve the case of the ID here to faithfully represent EIP-55 encoding
        }

        if (typeof data === "object") {
          for (let returnName of Object.keys(data)) {
            let fieldName = `${dasherize(methodName)}-${dasherize(returnName)}`;
            if (!fields.find(field => field.name === fieldName)) { continue; }
            model.attributes[fieldName] = data[returnName];
          }
        } else {
          model.attributes[fields[0].name] = data;
        }

        let existingRecord;
        try {
          existingRecord = (await this.searchers.getResourceAndMeta(Session.INTERNAL_PRIVILEGED, type, id.toLowerCase())).resource;
        } catch (err) {
          if (err.status !== 404) { throw err; }
        }
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

        await this._indexRecord(batch, attachMeta(model, { blockheight, contractName }));
      }
    }

    await batch.done();

    log.debug('completed indexing ethereum models with last indexed blockheight %j', blockHeight);
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
  attributes['transaction-hash'] = event.transactionHash;

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
