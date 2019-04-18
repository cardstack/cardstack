const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  routers: 'hub:routers'
},

class RoutingSearcher {
  static create(...args) {
    return new this(...args);
  }
  constructor({ routers }) {
    this.routers = routers;
  }

  //TODO rename 'type'
  async get({ session, sourceId, type, id, snapshotVersion, next }) {
    if (type === 'spaces') {
      return await this.routers.getSpace(id, session);
    }
    return next();
  }

  async search({ session, query, next }) {
    return next();
  }
});