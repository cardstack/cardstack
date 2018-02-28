const { BranchUpdate, owningDataSource } = require('./branch-update');

module.exports = class RunningIndexers {
  constructor(seedSchema, client) {
    this.seedSchema = seedSchema;
    this.client = client;
    this.seenDataSources = {};
    this.branches = {};
  }

  destroy() {
    for (let branchUpdate of Object.values(this.branches)) {
      branchUpdate.destroy();
    }
  }

  _findIndexer(dataSource) {
    if (dataSource.indexer) {
      owningDataSource.set(dataSource.indexer, dataSource);
      this.seenDataSources[dataSource.id] = true;
      return dataSource.indexer;
    }
  }

  async _loadSchemas() {
    let newIndexers = [...this.seedSchema.dataSources.values()]
        .map(this._findIndexer.bind(this))
        .filter(Boolean);
    while (newIndexers.length > 0) {
      let dirtyBranches = await this._activateIndexers(newIndexers);
      newIndexers = [];
      await Promise.all(dirtyBranches.map(async branch => {
        let schema = await this.branches[branch].schema();
        for (let dataSource of schema.dataSources.values()) {
          if (!this.seenDataSources[dataSource.id]) {
            let indexer = this._findIndexer(dataSource);
            if (indexer) {
              newIndexers.push(dataSource.indexer);
            }
          }
        }
      }));
    }
  }

  async _activateIndexers(indexers) {
    let dirtyBranches = {};
    await Promise.all(indexers.map(async indexer => {
      for (let branch of await indexer.branches()) {
        dirtyBranches[branch] = true;
        if (!this.branches[branch]) {
          this.branches[branch] = new BranchUpdate(branch, this.seedSchema, this.client);
        }
        await this.branches[branch].addIndexer(indexer);
      }
    }));
    return Object.keys(dirtyBranches);
  }

  async update(realTime, hints) {
    await this._loadSchemas();
    await Promise.all(Object.values(this.branches).map(branch => branch.update(realTime, hints)));
    return await this._schemas();
  }

  async schemas() {
    await this._loadSchemas();
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
