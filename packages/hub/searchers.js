const { declareInjections } = require('@cardstack/di');
const log = require('@cardstack/logger')('cardstack/searchers');
const Error = require('@cardstack/plugin-utils/error');
const Session = require('@cardstack/plugin-utils/session');

module.exports = declareInjections({
  controllingBranch: 'hub:controlling-branch',
  sources: 'hub:data-sources',
  internalSearcher: `plugin-searchers:${require.resolve('@cardstack/elasticsearch/searcher')}`
},

class Searchers {
  constructor() {
    this._lastActiveSources = null;
    this._searchers = null;
  }

  async _lookupSearchers() {
    let activeSources = await this.sources.active();
    if (activeSources !== this._lastActiveSources) {
      this._lastActiveSources = activeSources;
      this._searchers = [...activeSources.values()].map(v => v.searcher).filter(Boolean);
      this._searchers.push(this.internalSearcher);
      log.debug('found %s searchers', this._searchers.length);
    }
    return this._searchers;
  }

  async get(session, branch, type, id) {
    if (arguments.length < 4) {
      throw new Error(`session is now a required argument to searchers.get`);
    }
    let searchers = await this._lookupSearchers();
    let index = 0;
    let sessionOrEveryone = session || Session.EVERYONE;
    let next = async () => {
      let searcher = searchers[index++];
      if (searcher) {
        return searcher.get(sessionOrEveryone, branch, type, id, next);
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

  async getFromControllingBranch(session, type, id) {
    if (arguments.length < 3) {
      throw new Error(`session is now a required argument to searchers.getFromControllingBranch`);
    }
    return this.get(session, this.controllingBranch.name, type, id);
  }

  async search(session, branch, query) {
    if (arguments.length < 3) {
      throw new Error(`session is now a required argument to searchers.search`);
    }

    let searchers = await this._lookupSearchers();
    let index = 0;
    let sessionOrEveryone = session || Session.EVERYONE;
    let next = async () => {
      let searcher = searchers[index++];
      if (searcher) {
        return searcher.search(sessionOrEveryone, branch, query, next);
      }
    };
    return next();
  }

  async searchInControllingBranch(session, query) {
    if (arguments.length < 2) {
      throw new Error(`session is now a required argument to searchers.searchInControllingBranch`);
    }
    return this.search(session, this.controllingBranch.name, query);
  }


});
