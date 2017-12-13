const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  indexers: 'hub:indexers',
  controllingBranch: 'hub:controlling-branch'
},

class CurrentSchema {
  async forBranch(branch) {
    return this.indexers.schemaForBranch(branch);
  }
  async forControllingBranch() {
    return this.forBranch(this.controllingBranch.name);
  }
  invalidateCache() {
    this.indexers.invalidateSchemaCache();
  }
});
