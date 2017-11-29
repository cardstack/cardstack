const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  indexers: 'hub:indexers'
},

class CurrentSchema {
  async forBranch(branch) {
    return this.indexers.schemaForBranch(branch);
  }
  invalidateCache() {
    this.indexers.invalidateSchemaCache();
  }
});
