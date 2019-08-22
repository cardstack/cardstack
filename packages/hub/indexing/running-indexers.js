const SourcesUpdate = require('./sources-update');
const DataSource = require('../schema/data-source');
const log = require('@cardstack/logger')('cardstack/indexers');
const { flatten } = require('lodash');

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
    let staticSchema = staticModels.filter(doc => this.schemaTypes.includes(doc.type));
    this.sourcesUpdater.addStaticModels(staticSchema, staticModels);
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