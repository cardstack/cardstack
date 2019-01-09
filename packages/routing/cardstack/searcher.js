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

  async get(session, branch, type, id, next) {
    if (type === 'spaces') {
      return await this.routers.getSpace(branch, id, session);
    }
    return next();
  }

  async search(session, branch, query, next) {
    return next();
  }
});