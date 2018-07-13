const { declareInjections } = require('@cardstack/di');
const log = require('@cardstack/logger')('cardstack/searchers');
const Error = require('@cardstack/plugin-utils/error');
const Session = require('@cardstack/plugin-utils/session');
const DocumentContext = require('./indexing/document-context');
const { get } = require('lodash');

module.exports = declareInjections({
  controllingBranch: 'hub:controlling-branch',
  sources: 'hub:data-sources',
  internalSearcher: `plugin-searchers:${require.resolve('@cardstack/pgsearch/searcher')}`,
  currentSchema: 'hub:current-schema'
},

class Searchers {
  constructor() {
    this._lastActiveSources = null;
    this._sources = null;
  }

  async _lookupSources() {
    let activeSources = await this.sources.active();
    if (activeSources !== this._lastActiveSources) {
      this._lastActiveSources = activeSources;
      this._sources = [...activeSources.values()].filter(v => v.searcher);
      this._sources.push({ searcher: this.internalSearcher });
      log.debug('found %s searchers', this._sources.length);
    }
    return this._sources;
  }

  async get(session, branch, type, id) {
    if (arguments.length < 4) {
      throw new Error(`session is now a required argument to searchers.get`);
    }
    let sources = await this._lookupSources();
    let index = 0;
    let sessionOrEveryone = session || Session.EVERYONE;
    let schemaPromise = this.currentSchema.forBranch(branch);
    let next = async () => {
      let source = sources[index++];
      if (source) {
        let response = await source.searcher.get(sessionOrEveryone, branch, type, id, next);
        if (source.id != null && response && response.data) {
          if (!response.data.meta) {
            response.data.meta = {};
          }
          if (response.data.meta.source == null) {
            response.data.meta.source = source.id;
          }
        }
        return response;
      }
    };
    let result = await next();

    if (result) {
      let schema = await schemaPromise;
      result = await schema.applyReadAuthorization(result, { session, type, id });
    }

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
    let sources = await this._lookupSources();
    let schemaPromise = this.currentSchema.forBranch(branch);
    let index = 0;
    let sessionOrEveryone = session || Session.EVERYONE;
    let next = async () => {
      let source = sources[index++];
      if (source) {
        let response = await source.searcher.search(sessionOrEveryone, branch, query, next);
        response.data.forEach(resource => {
          if (!resource.meta) {
            resource.meta = {};
          }
          if (resource.meta.source == null) {
            resource.meta.source = source.id;
          }
        });
        return response;
      }
    };
    let result = await next();
    if (result) {
      let schema = await schemaPromise;
      let include = get(query, 'queryString.include');
      let additionalIncludes = include ? include.split(',').map(part => part.split('.')) : [];
      let pristineResult = await (new DocumentContext({
        branch,
        schema,
        upstreamDoc: result,
        additionalIncludes,
        read: this._read(branch)
      }).pristineDoc());

      let authorizedResult = await schema.applyReadAuthorization(pristineResult, { session });
      if (authorizedResult.data.length !== pristineResult.data.length) {
        // We can eventually make this more of just a warning, but for
        // now it's cleaner to just force the searchers to implement
        // grants correctly. Otherwise we will need to be able to
        // adjust pagination and meta stats.
        throw new Error(`A searcher tried to include resources that are outside the allowed session scope`);
      }
      return authorizedResult;
    }
  }

  async searchInControllingBranch(session, query) {
    if (arguments.length < 2) {
      throw new Error(`session is now a required argument to searchers.searchInControllingBranch`);
    }
    return this.search(session, this.controllingBranch.name, query);
  }

  _read(branch) {
    return async (type, id) => {
      let result;
      try {
        result = await this.get(Session.INTERNAL_PRIVILEGED, branch, type, id);
      } catch (err) {
        if (err.status !== 404) { throw err; }
      }

      if (result && result.data) {
        return result.data;
      }
    };
  }

});
