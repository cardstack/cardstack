const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections(
  {
    currentSchema: 'hub:current-schema',
  },

  class DataSources {
    async active() {
      let schema = await this.currentSchema.getSchema();
      return schema.getDataSources();
    }
  }
);
