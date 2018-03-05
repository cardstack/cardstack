const { BranchUpdate, owningDataSource } = require('./branch-update');
const DataSource = require('../schema/data-source');
const log = require('@cardstack/logger')('cardstack/indexers');
const { flatten } = require('lodash');

log.registerFormatter('t', require('../table-log-formatter'));

module.exports = class RunningIndexers {
  constructor(seedSchema, client, emitEvent) {
    this.seedSchema = seedSchema;
    this.client = client;
    this.ownedDataSources = {};
    this.seenDataSources = {};
    this.emitEvent = emitEvent;
    this.branches = {};
  }

  destroy() {
    for (let branchUpdate of Object.values(this.branches)) {
      branchUpdate.destroy();
    }
    for (let dataSource of Object.values(this.ownedDataSources)) {
      dataSource.teardown();
    }
  }

  _findIndexer(dataSource) {
    this.seenDataSources[dataSource.id] = true;
    if (dataSource.indexer) {
      owningDataSource.set(dataSource.indexer, dataSource);
      return dataSource.indexer;
    }
  }

  async _loadSchemaModels() {
    let newIndexers = [...this.seedSchema.dataSources.values()]
        .map(this._findIndexer.bind(this))
        .filter(Boolean);
    while (newIndexers.length > 0) {
      let newSchemaModels = await this._activateIndexers(newIndexers);
      newIndexers = newSchemaModels.map(model => {
        log.debug("new schema model %s %s", model.type, model.id);
        if (model.type === 'data-sources' && !this.seenDataSources[model.id]) {
          log.debug("Discovered data source %s", model.id);
          let dataSource = new DataSource(model, this.seedSchema.plugins);
          this.ownedDataSources[model.id] = dataSource;
          return this._findIndexer(dataSource);
        }
      }).filter(Boolean);
    }
  }

  async _activateIndexers(indexers) {
    log.debug("=Activating indexers=\n%t", () => indexers.map(i => {
      let source = owningDataSource.get(i);
      return [ source.sourceType, source.id ];
    }));
    let newSchemaModels = [];
    await Promise.all(indexers.map(async indexer => {
      for (let branch of await indexer.branches()) {
        if (!this.branches[branch]) {
          log.debug("Discovered branch %s", branch);
          this.branches[branch] = new BranchUpdate(branch, this.seedSchema, this.client, this.emitEvent);
        }
        newSchemaModels.push(await this.branches[branch].addIndexer(indexer));
      }
    }));
    return flatten(newSchemaModels);
  }

  async update(realTime, hints) {
    await this._loadSchemaModels();
    await Promise.all(Object.values(this.branches).map(branch => branch.update(realTime, hints)));
    return await this._schemas();
  }

  async schemas() {
    await this._loadSchemaModels();
    return await this._schemas();
  }

  async _schemas() {
    let schemas = Object.create(null);
    for (let [branch, branchUpdate] of Object.entries(this.branches)) {
      schemas[branch] = await branchUpdate.schema();
    }
    return schemas;
  }
};
