const SourcesUpdate = require('./sources-update');
const DataSource = require('../schema/data-source');
const log = require('@cardstack/logger')('cardstack/indexers');
const { get, flatten } = require('lodash');
const { cardContextFromId, cardContextToId } = require('@cardstack/plugin-utils/card-context');

log.registerFormatter('t', require('../table-log-formatter'));

module.exports = class RunningIndexers {
  constructor(seedSchema, client, emitEvent, schemaTypes, owner) {
    this.seedSchema = seedSchema;
    this.client = client;
    this.emitEvent = emitEvent;
    this.schemaTypes = schemaTypes;
    this.owner = owner;
    this.ownedDataSources = {};
    this.seenDataSources = {};
    this.staticModels = [];
    this._cardSchemas = null;
    this.sourcesUpdater = new SourcesUpdate(seedSchema, client, emitEvent, owner);
  }

  async destroy() {
    await this.sourcesUpdater.destroy();
    for (let dataSource of Object.values(this.ownedDataSources)) {
      await dataSource.teardown();
    }
  }

  _sawDataSource(dataSource) {
    this.seenDataSources[dataSource.id] = true;
    return dataSource;
  }

  async _loadSchemaModels() {
    let newDataSources = [...this.seedSchema.getDataSources().values()]
        .map(this._sawDataSource.bind(this));

    log.debug(`RunningIndexers._loadSchemaModels() found ${newDataSources.length} newDataSources`);
    while (newDataSources.length > 0) {
      let newSchemaModels = await this._activateDataSources(newDataSources);
      newDataSources = newSchemaModels.map(model => {
        log.debug("new schema model %s %s", model.type, model.id);
        if (model.type === 'data-sources' && !this.seenDataSources[model.id]) {
          log.debug("Discovered data source %s", model.id);
          let dataSource = new DataSource(model, this.seedSchema.plugins);
          this.ownedDataSources[model.id] = dataSource;
          return this._sawDataSource(dataSource);
        }
      }).filter(Boolean);
    }

    let staticModels = flatten(this.staticModels);
    let staticSchema = staticModels // TODO eventually we will not obtain schema from static-models
      .filter(doc => this.schemaTypes.includes(doc.type))
      .concat(this.cardSchemas);
    this.sourcesUpdater.addStaticModels(staticSchema, staticModels.concat(this.cardSchemas));
  }

  get cardSchemas() {
    if (this._cardSchemas) { return this._cardSchemas; }

    let schemas = [];
    let plugins = this.seedSchema.plugins;
    let features = this.seedSchema.plugins.featuresOfType('schemas');
    for (let feature of features) {
      let { id:featureName } = feature;
      let factory = plugins.lookupFeatureFactory('schemas', featureName);
      // It's not clear to me how you could load card schema from different sources if we load card schema outside of a data-source context...
      let sourceId = 'local-hub';
      let packageName = get(feature, 'relationships.plugin.data.id');
      let schemaDocument = factory.class.call();
      if (!schemaDocument) {
        throw new Error(`No schema document returned from schema feature for package: '${packageName}'`);
      }

      addCardDefinitionContext(sourceId, packageName, schemaDocument);
      validateCardSchema(this.schemaTypes, sourceId, packageName, schemaDocument);

      schemas = schemas.concat(modelsOf(schemaDocument));
    }
    this._cardSchemas = schemas;
    return this._cardSchemas;
  }

  async _activateDataSources(dataSources) {
    log.debug("=Activating data sources=\n%t", () => dataSources.map(source => {
      return [ source.sourceType, source.id ];
    }));
    let newSchemaModels = [];
    let staticModelsDataSources = dataSources.filter(ds => ds.sourceType === '@cardstack/hub::static-models');

    await Promise.all(dataSources.filter(ds => ds.sourceType !== '@cardstack/hub::static-models').map(async source => {
      let indexer = source.indexer;
      if (indexer) {
        await Promise.all(staticModelsDataSources.map(async staticSource => {
          newSchemaModels.push(await this.sourcesUpdater.addDataSource(staticSource));
        }));
        newSchemaModels.push(await this.sourcesUpdater.addDataSource(source));
      }
      if (source.staticModels.length > 0) {
        // this ensures that static models can contain more data
        // sources and they will actually get crawled correctly.
        newSchemaModels.push(source.staticModels);
        // and this is where we gather all staticModels until the next
        // step where we will actually let them get indexed
        this.staticModels.push(source.staticModels);
      }
    }));
    return flatten(newSchemaModels).filter(Boolean);
  }

  async update(forceRefresh, hints) {
    log.debug('starting RunningIndexers.update()');
    await this._loadSchemaModels();

    await this.sourcesUpdater.update(forceRefresh, hints);
    return await this.sourcesUpdater.takeSchema();
  }

  async schemas() {
    await this._loadSchemaModels();
    return await this.sourcesUpdater.takeSchema();
  }
};

function addCardDefinitionContext(sourceId, packageName, schemaDocument) {
  let { data: cardDefinition, included = [] } = schemaDocument;
  let idMap = {};

  if (cardDefinition.type !== 'card-definitions') {
    throw new Error(`The schema feature for the package '${packageName}' defines a schema document that is not of type 'card-definitions', found ${cardDefinition.type}.`);
  }
  idMap[`card-definitions/${cardDefinition.id}`] = cardContextToId({ sourceId, packageName });
  for (let resource of included) {
    // schema models are treated as cards
    let cardId = ['content-types', 'fields'].includes(resource.type) ? get(resource, 'attributes.name') : resource.id;
    idMap[`${resource.type}/${resource.id}`] = cardContextToId({ sourceId, packageName, cardId });
  }

  replaceIdsForResource(cardDefinition, idMap);
  for (let resource of included) {
    replaceIdsForResource(resource, idMap);
  }
}

function validateCardSchema(schemaTypes, sourceId, packageName, schemaDocument = {}) {
  let { included = [], data: cardDefinition } = schemaDocument;
  let nonSchemaModels = included.filter(i => !schemaTypes.includes(i.type)).map(i => `${i.type}/${i.id}`);
  if (nonSchemaModels.length) {
    throw new Error(`The package '${packageName}' defines schema that includes non-schema models. Non-schema models are not allowed in schemas. Found non-schema models: ${JSON.stringify(nonSchemaModels)}`);
  }

  let {
    sourceId: cardDefinitionSourceId,
    packageName: cardDefinitionPackageName
  } = cardContextFromId(cardDefinition.id);
  if (sourceId !== cardDefinitionSourceId || packageName !== cardDefinitionPackageName) {
    throw new Error(`The schema for package '${packageName}' is has a card-definitions model id, '${cardDefinition.id}', that is not scoped for this source::package, "${sourceId}::${packageName}".`);
  }

  let cardScopeRegex = new RegExp(`^${sourceId}::${packageName}::`);
  let unscopedModels = included.filter(i => !i.id.match(cardScopeRegex)).map(i => `${i.type}/${i.id}`);
  if (unscopedModels.length) {
    throw new Error(`The schema for package '${packageName}' has schema models that are not scoped to this data source and package ${JSON.stringify(unscopedModels)}`);
  }
}

function replaceIdsForResource(resource, idMap) {
  resource.id = idMap[`${resource.type}/${resource.id}`] || resource.id;
  if (!resource.relationships) { return; }

  for (let relationship of Object.keys(resource.relationships)) {
    if (resource.relationships[relationship].data && Array.isArray(resource.relationships[relationship].data)) {
      resource.relationships[relationship].data.forEach(ref => {
        ref.id = idMap[`${ref.type}/${ref.id}`] || ref.id;
      });
    } else if (resource.relationships[relationship].data) {
      let ref = resource.relationships[relationship].data;
      ref.id = idMap[`${ref.type}/${ref.id}`] || ref.id;
    }
  }
}

function modelsOf(document = {}) {
  let { data, included = [] } = document;
  if (!data) { return []; }

  let models = [data];
  return models.concat(included);
}