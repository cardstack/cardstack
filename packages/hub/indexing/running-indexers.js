const { BranchUpdate } = require('./branch-update');
const DataSource = require('../schema/data-source');
const log = require('@cardstack/logger')('cardstack/indexers');
const { flatten } = require('lodash');

log.registerFormatter('t', require('../table-log-formatter'));

module.exports = class RunningIndexers {
  constructor(seedSchema, client, emitEvent, schemaTypes, controllingBranch, owner) {
    this.seedSchema = seedSchema;
    this.client = client;
    this.emitEvent = emitEvent;
    this.schemaTypes = schemaTypes;
    this.controllingBranch = controllingBranch;
    this.owner = owner;
    this.ownedDataSources = {};
    this.seenDataSources = {};
    this.branches = {};
    this.staticModels = [];
  }

  async destroy() {
    for (let branchUpdate of Object.values(this.branches)) {
      await branchUpdate.destroy();
    }
    for (let dataSource of Object.values(this.ownedDataSources)) {
      await dataSource.teardown();
    }
  }

  _sawDataSource(dataSource) {
    this.seenDataSources[dataSource.id] = true;
    return dataSource;
  }

  async _loadSchemaModels() {
    let newDataSources = [...this.seedSchema.dataSources.values()]
        .map(this._sawDataSource.bind(this));

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
    Object.values(this.branches).forEach(branchUpdate => {
      branchUpdate.addStaticModels(staticSchema, staticModels);
    });
  }

  async _activateDataSources(dataSources) {
    log.debug("=Activating data sources=\n%t", () => dataSources.map(source => {
      return [ source.sourceType, source.id ];
    }));
    let newSchemaModels = [];

    let staticModelsDataSources = dataSources.filter(ds => ds.sourceType === '@cardstack/hub::static-models');

    await Promise.all(dataSources.filter(ds => ds.sourceType !== '@cardstack/hub::static-models').map(async source => {
      let indexer = source.indexer;
      if (indexer){
        for (let branch of await indexer.branches()) {
          if (!this.branches[branch]) {
            log.debug("Discovered branch %s", branch);
            this.branches[branch] = new BranchUpdate(branch, this.seedSchema, this.client, this.emitEvent, this.controllingBranch === branch, this.owner);

            // add all staticModels dataSources to all branches
            await Promise.all(staticModelsDataSources.map(async staticSource => {
              newSchemaModels.push(await this.branches[branch].addDataSource(staticSource));
            }));
          }
          newSchemaModels.push(await this.branches[branch].addDataSource(source));
        }
      }
      let staticModels = source.staticModels;
      if (staticModels.length > 0) {
        // this ensures that static models can contain more data
        // sources and they will actually get crawled correctly.
        newSchemaModels.push(staticModels);
        // and this is where we gather all staticModels until the next
        // step where we will actually let them get indexed
        this.staticModels.push(staticModels);
      }
    }));
    return flatten(newSchemaModels);
  }

  async update(forceRefresh, hints) {
    await this._loadSchemaModels();

    await Promise.all(Object.values(this.branches).map(branch => branch.update(forceRefresh, hints)));

    await Promise.all(Object.keys(this.branches).map((branch) => {
      return this.branches[this.controllingBranch].add(
        'branches',
        branch,
        { data: {id: branch, type: 'branches', attributes: {}}},
      );
    }));
    
    return await this._schemas();
  }

  async schemas() {
    await this._loadSchemaModels();
    return await this._schemas();
  }

  async _schemas() {
    let schemas = Object.create(null);
    for (let [branch, branchUpdate] of Object.entries(this.branches)) {
      schemas[branch] = await branchUpdate.takeSchema();
    }
    return schemas;
  }
};
