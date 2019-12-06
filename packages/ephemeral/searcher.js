const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections(
  {
    service: `plugin-services:${require.resolve('./service')}`,
  },

  class EphemeralSearcher {
    static create(...args) {
      return new this(...args);
    }
    constructor({ dataSource, service, config }) {
      this.config = config;
      this.dataSource = dataSource;
      this.service = service;
    }

    async get(session, type, id, next) {
      return next();
    }

    async search(session, query, next) {
      return next();
    }

    async getBinary(session, type, id) {
      let storage = await this.service.findOrCreateStorage(this.dataSource.id);
      let result = storage.lookupBinary(type, id);
      return result;
    }
  }
);
