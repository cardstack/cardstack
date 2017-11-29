const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  schemaCache: 'hub:schema-cache'
},

class CurrentSchema {
  async forBranch(branch) {
    return this.schemaCache.schemaForBranch(branch);
  }
});
