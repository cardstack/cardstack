const { declareInjections } = require('@cardstack/di');
const log = require('@cardstack/logger')('cardstack/searchers');
const Error = require('@cardstack/plugin-utils/error');
const Session = require('@cardstack/plugin-utils/session');
const DocumentContext = require('./indexing/document-context');
const { get } = require('lodash');

const localHubSource = 'local-hub';

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

  async getSpace(session, path) {
    return await this.get(session, localHubSource, 'spaces', path);
  }

  async get(session, source, packageName, cardId, opts={}) {
    if (source !== localHubSource) {
      throw new Error(`You specified the source: '${source}' in Searchers.get(). Currently the cardstack hub does not support non-local hub sources.`);
    }
    if (arguments.length === 5 && typeof opts !== 'object') {
      throw new Error(`Searchers.get() expects parameters: 'session', 'source', packageName', 'cardId', and 'opts'. The 'branch' parameter has been deprecated, instead specify 'opts.version'`);
    }

    let { version, includePaths } = opts;
    // only ever get the branches off the controlling branch
    if (packageName === 'branches' || !version) {
      version = this.controllingBranch.name;
    }

    let { resource, meta, included } = await this.getResourceAndMeta(session, version, packageName, cardId);
    let authorizedResult;
    let documentContext;
    if (resource) {
      let schema = await this.currentSchema.forBranch(version);
      documentContext = this.createDocumentContext({
        id: cardId,
        type: packageName,
        branch: version,
        schema,
        includePaths,
        upstreamDoc: { data: resource, meta, included }
      });
      authorizedResult = await documentContext.applyReadAuthorization({ session, packageName, cardId });
    }

    if (!authorizedResult) {
      throw new Error(`No such resource ${version}/${packageName}/${cardId}`, {
        status: 404
      });
    }

    return authorizedResult;
  }

  async getBinary(session, source, packageName, cardId, type, modelId, opts) {
    // look up authorized result to check read is authorized by going through
    // the default auth stack for the JSON representation. Error will be thrown
    // if authorization is not correct.
    let { version:branch } = opts;

    // TODO this needs to get the card's internal model that backs the binary data.
    // this.get() will ultimately be the incorrect place to retrieve this from...
    let document = await this.get(session, source, type, modelId, { version: branch });

    // TODO ultimately there will be no need to look up the source as it is being provided
    // as an argument to this method.
    let sourceId = document.data.meta.source;
    let sources = await this._lookupSources();

    // we don't need to take a middleware-like approach here because we already
    // searched for the json representation, so we know exactly what data source
    // to get the binary blob from
    let dataSource = sources.find(s => s.id === sourceId);

    let sessionOrEveryone = session || Session.EVERYONE;
    let result = await dataSource.searcher.getBinary(sessionOrEveryone, branch, type, modelId);

    return [result, document];
  }

  async getFromControllingBranch() {
    throw new Error(`Searchers.getFromControllingBranch() has been deprecated. Use Searchers.get() instead.`);
  }

  async search(session, query, version) {
    if (typeof query !== 'object') {
      throw new Error(`Searchers.get() expects parameters: 'session', 'query', and 'version' (aka branch)`);
    }
    // only ever get the branches off the controlling branch
    if (get(query,'filter.type.exact') === "branches" || !version) {
      version = this.controllingBranch.name;
    }

    let sources = await this._lookupSources();
    let schemaPromise = this.currentSchema.forBranch(version);
    let index = 0;
    let sessionOrEveryone = session || Session.EVERYONE;
    let next = async () => {
      let source = sources[index++];
      if (source) {
        let response = await source.searcher.search(sessionOrEveryone, version, query, next);
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
        branch: version,
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
    throw new Error(`Searchers.searchFromControllingBranch() has been deprecated. Use Searchers.search() instead.`);
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
