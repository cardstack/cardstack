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
  client: `plugin-client:${require.resolve('@cardstack/pgsearch/client')}`,
  currentSchema: 'hub:current-schema',
  jobQueue: 'hub:queues'
},

class Searchers {
  constructor() {
    this._lastActiveSources = null;
    this._sources = null;
    this._cachingPromise; // use this promise to handle the async for testing document caching
    this._workersSetup = false;
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

  async getResourceAndMeta(session, branchRequest, type, id) {
    let branch = branchRequest;

    // only ever get the branches off the controlling branch
    if (type === 'branches') {
      branch = this.controllingBranch.name;
    }

    let sources = await this._lookupSources();
    let index = 0;
    let sessionOrEveryone = session || Session.EVERYONE;
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

    let { data, meta, included } = result || {};
    let maxAge = get(result, 'meta.cardstack-cache-control.max-age');
    if (data && maxAge != null) {
      await this._startCacheJob(branch, { data, meta, included }, maxAge);
    }
    return { resource: data, meta, included };
  }

  // not using DI to prevent circular dependency
  _getRouters() {
    if (this.routers) { this.routers; }

    this.routers = this.__owner__.lookup('hub:routers');
    return this.routers;
  }

  async get() {
    throw new Error(`Searchers.get() has been deprecated. Use either Searchers.getModel() or Searchers.getCard()`);
  }

  // TODO eventually we'll require that you can only get Models within your card context
  // Depending on how this refactor shakes out--we might end up removing this entirely...
  async getModel(session, type, id, opts) {
    return await this.getCard(session, type, id, opts);
  }

  // TODO we dont really need this--just overload Searchers.get
  async getSpace(session, path) {
    return await this.getCard(session, 'spaces', path);
  }

  async getCard(session, packageName, id, opts={}) {
    if (arguments.length === 4 && typeof opts !== 'object') {
      throw new Error(`Searchers.get() expects parameters: 'session', 'package', 'id', and 'opts'. The 'branch' parameter has been deprecated, instead specify 'opts.version'`);
    }

    let { version, includePaths } = opts;
    // only ever get the branches off the controlling branch
    if (packageName === 'branches' || !version) {
      version = this.controllingBranch.name;
    }

    let { resource, meta, included } = await this.getResourceAndMeta(session, version, packageName, id);
    let authorizedResult;
    let documentContext;
    if (resource) {
      let schema = await this.currentSchema.forBranch(version);
      documentContext = this.createDocumentContext({
        id,
        type: packageName,
        branch: version,
        schema,
        includePaths,
        upstreamDoc: { data: resource, meta, included }
      });
      authorizedResult = await documentContext.applyReadAuthorization({ session, packageName, id });
    }

    if (!authorizedResult) {
      throw new Error(`No such resource ${version}/${packageName}/${id}`, {
        status: 404
      });
    }

    return authorizedResult;
  }

  // TODO eventually we'll require that you can only get binary within your card context
  // This is akin to getting a model...
  async getBinary(session, branch, type, id, includePaths) {
    // look up authorized result to check read is authorized by going through
    // the default auth stack for the JSON representation. Error will be thrown
    // if authorization is not correct.
    let document = await this.getModel(session, type, id, { includePaths, version: branch });

    let sourceId = document.data.meta.source;

    let sources = await this._lookupSources();

    let sessionOrEveryone = session || Session.EVERYONE;


    // we don't need to take a middleware-like approach here because we already
    // searched for the json representation, so we know exactly what data source
    // to get the binary blob from
    let source = sources.find(s => s.id === sourceId);

    let result = await source.searcher.getBinary(sessionOrEveryone, branch, type, id);

    return [result, document];
  }

  async getFromControllingBranch() {
    throw new Error(`Searchers.getFromControllingBranch() has been deprecated. Use Searchers.getCard() instead.`);
  }

  async search() {
    throw new Error(`Searchers.search() has been deprecated. Use Searchers.searchForCard() or Searchers.searchForModel() instead.`);
  }

  // TODO assert default version if none is specifed?
  async searchForCard(session, branchRequest, query) {
    if (typeof query !== 'object') {
      throw new Error(`Searchers.search() expects parameters: 'session', and 'query'. If you want to search for a particular version (aka branch) of content it must be part of your query.`);
    }

    let branch = branchRequest;

    // only ever get the branches off the controlling branch
    if (get(query,'filter.type.exact') === "branches") {
      branch = this.controllingBranch.name;
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
      let includePaths = (get(query, 'include') || '').split(',');
      let documentContext = this.createDocumentContext({
        branch,
        schema,
        includePaths,
        upstreamDoc: result,
      });

      let authorizedResult = await documentContext.applyReadAuthorization({ session });
      let pristineResult = await documentContext.pristineDoc();
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

  async searchFromControllingBranch() {
    throw new Error(`Searchers.searchFromControllingBranch() has been deprecated. Use Searchers.searchForCurrentCard() instead.`);
  }

  // TODO remove this
  async searchForCurrentCard(session, query) {
    return await this.search(session, this.controllingBranch.name, query);
  }

  createDocumentContext({ schema, type, id, branch, sourceId, generation, upstreamDoc, includePaths }) {
    return new DocumentContext({
      schema,
      type,
      id,
      branch,
      sourceId,
      generation,
      upstreamDoc,
      includePaths,
      routers: this._getRouters(),
      read: this._read(branch)
    });
  }

  async searchInControllingBranch(session, query) {
    if (arguments.length < 2) {
      throw new Error(`session is now a required argument to searchers.searchInControllingBranch`);
    }
    return this.search(session, this.controllingBranch.name, query);
  }

  _read(branch) {
    return async (type, id) => {
      let resource;
      try {
        resource = (await this.getResourceAndMeta(Session.INTERNAL_PRIVILEGED, branch, type, id)).resource;
      } catch (err) {
        if (err.status !== 404) { throw err; }
      }
      return resource;
    };
  }

  async _setupWorkers() {
    if (this._workersSetup) { return; }

    this._workersSetup = true;
    await this.jobQueue.subscribe("hub/searchers/cache", async ({ data: { branch, maxAge, upstreamDoc } }) => {
      this._cachingPromise = Promise.resolve(this._cachingPromise)
        .then(() => this._cacheDocument(branch, upstreamDoc, maxAge));
      return await this._cachingPromise;
    });
  }

  async _startCacheJob(branch, upstreamDoc, maxAge) {
    await this._setupWorkers();

    await this.jobQueue.publishAndWait('hub/searchers/cache',
      { branch, upstreamDoc, maxAge },
      { singletonKey: 'hub/searchers/cache', singletonNextSlot: true }
    );
  }

  async _cacheDocument(branch, upstreamDoc, maxAge) {
    let { data: { id, type } } = upstreamDoc;
    let schema = await this.currentSchema.forBranch(branch);
    let documentContext = this.createDocumentContext({
      id,
      type,
      branch,
      schema,
      upstreamDoc: upstreamDoc
    });

    let batch = this.client.beginBatch(this.currentSchema, this);
    try {
      await batch.saveDocument(documentContext, { maxAge });
    } finally {
      await batch.done();
    }
  }

});
