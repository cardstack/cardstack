const { declareInjections } = require('@cardstack/di');
const logger = require('heimdalljs-logger');
const Error = require('@cardstack/plugin-utils/error');

module.exports = declareInjections({
  schemaCache: 'hub:schema-cache',
  internalSearcher: 'searcher:@cardstack/elasticsearch/searcher'
},

class Searchers {
  constructor() {
    this._lastControllingSchema = null;
    this._searchers = null;
    this.log = logger('searchers');
  }

  async _lookupSearchers() {
    let schema = await this.schemaCache.schemaForControllingBranch();
    if (schema !== this._lastControllingSchema) {
      this._lastControllingSchema = schema;
      this._searchers = [...schema.dataSources.values()].map(v => v.searcher).filter(Boolean);
      this._searchers.push(this.internalSearcher);
      this.log.debug('found %s searchers', this._searchers.length);
    }
    return this._searchers;
  }

  async get(branch, type, id) {
    let searchers = await this._lookupSearchers();
    let index = 0;
    let next = async () => {
      let searcher = searchers[index++];
      if (searcher) {
        return searcher.get(branch, type, id, next);
      }
    };
    let result = await next();
    if (!result) {
      throw new Error(`No such resource ${branch}/${type}/${id}`, {
        status: 404
      });
    }
    return result;
  }

  async search(branch, query) {
    let searchers = await this._lookupSearchers();
    let index = 0;
    let next = async () => {
      let searcher = searchers[index++];
      if (searcher) {
        return searcher.search(branch, query, next);
      }
    };
    return next();
  }


});
