const { declareInjections }   = require('@cardstack/di');

module.exports = declareInjections({
  service: `plugin-services:${require.resolve('./service')}`,
},

class EphemeralSearcher {
  static create(...args) {
    return new this(...args);
  }
  constructor({ dataSource, service, config, branches }) {
    this.config       = config;
    this.branches     = branches;
    this.dataSource   = dataSource;
    this.service     = service;
  }

  async get(session, branch, type, id, next) {
    return next();
  }

  async search(session, branch, query, next) {
    return next();
  }

  async getBinary(session, branch, type, id, next) {
    let storage = await this.service.findOrCreateStorage(this.dataSource.id);
    let result = storage.lookupBinary(type, id);
    if (result) {
      return result;
    }
    return next();
  }
});
