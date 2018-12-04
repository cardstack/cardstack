const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  searchers: 'hub:searchers',
  schema: 'hub:current-schema',
  routers: 'hub:routers'
},

class RoutingSearcher {
  static create(...args) {
    return new this(...args);
  }
  constructor({ dataSource, searchers, schema, routers}) {
    this.dataSource = dataSource;
    this.searchers = searchers;
    this.schema = schema;
    this.routers = routers;
  }

  async get(session, branch, type, id, next) {
    if (type === 'spaces') {
      return await this.routers.getSpace(branch, id);
    }
    return next();
  }

  async search(session, branch, query, next) {
    return next();
  }
});