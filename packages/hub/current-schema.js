const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  indexers: 'hub:indexers',
},

class CurrentSchema {
  async getSchema() {
    return this.indexers.schema();
  }
  invalidateCache() {
    this.indexers.invalidateSchemaCache();
  }
});
