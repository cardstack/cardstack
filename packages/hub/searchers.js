const { declareInjections } = require('@cardstack/di');
const logger = require('@cardstack/plugin-utils/logger');
const Error = require('@cardstack/plugin-utils/error');

module.exports = declareInjections({
  controllingBranch: 'hub:controlling-branch',
  sources: 'hub:data-sources',
  internalSearcher: `plugin-searchers:${require.resolve('@cardstack/elasticsearch/searcher')}`
},

class Searchers {
  constructor() {
    this._lastActiveSources = null;
    this._searchers = null;
    this.log = logger('searchers');
  }

  async _lookupSearchers() {
    let activeSources = await this.sources.active();
    if (activeSources !== this._lastActiveSources) {
      this._lastActiveSources = activeSources;
      this._searchers = [...activeSources.values()].map(v => v.searcher).filter(Boolean);
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

  async getFromControllingBranch(type, id) {
    return this.get(this.controllingBranch.name, type, id);
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

  async searchInControllingBranch(query) {
    return this.search(this.controllingBranch.name, query);
  }


});
