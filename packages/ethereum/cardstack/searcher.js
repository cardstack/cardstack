const { get } = require('lodash');
const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  searchers: 'hub:searchers',
},

class EthereumSearcher {
  static create(...args) {
    return new this(...args);
  }
  constructor({ searchers, dataSource }) {
    this.searchers = searchers;
    this.dataSourceId = dataSource.id;
  }

  async get(session, branch, type, id, next) {
    if (type === 'tracked-ethereum-addresses') {
      let result = await this.searchers.get(session, branch, 'proxied-tracked-ethereum-addresses', id);
      result.data.type = 'tracked-ethereum-addresses';
      result.data.meta.source = this.dataSourceId;
      result.data.meta.version = 1;
      return result;
    }

    return next();
  }

  async search(session, branch, query, next) {
    if (get(query, 'filter.type.exact') === 'tracked-ethereum-addresses') {
      query.filter.type.exact = 'proxied-tracked-ethereum-addresses';
      let { data: result } = await this.searchers.search(session, branch, query);

      return {
        data: result.map(i => {
          i.type = 'tracked-ethereum-addresses';
          i.meta.source = this.dataSourceId;
          i.meta.version = 1;
          return i;
        })
      };
    }

    return next();
  }
});