const { declareInjections } = require('@cardstack/di');
const log = require('@cardstack/logger')('cardstack/searchers');
const Error = require('@cardstack/plugin-utils/error');
const Session = require('@cardstack/plugin-utils/session');
const DocumentContext = require('./indexing/document-context');
const { get } = require('lodash');

const localHubSource = 'local-hub';

module.exports = declareInjections({
  sources: 'hub:data-sources',
  internalSearcher: `plugin-searchers:${require.resolve('@cardstack/pgsearch/searcher')}`,
  client: `plugin-client:${require.resolve('@cardstack/pgsearch/client')}`,
  currentSchema: 'hub:current-schema',
  jobQueue: 'hub:queues',
  indexers: 'hub:indexers'
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

  async getResourceAndMeta(session, type, id) {
    let sources = await this._lookupSources();
    let index = 0;
    let sessionOrEveryone = session || Session.EVERYONE;
    let next = async () => {
      let source = sources[index++];
      if (source) {
        let response = await source.searcher.get(sessionOrEveryone, type, id, next);
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
      await this._startCacheJob({ data, meta, included }, maxAge);
    }
    return { resource: data, meta, included };
  }

  // not using DI to prevent circular dependency
  _getRouters() {
    if (this.routers) { return this.routers; }
    return this.routers = this.__owner__.lookup('hub:routers');
  }

  async getSpace(session, path) {
    return await this.get(session, localHubSource, 'spaces', path);
  }

  // TODO the source id is actually baked into the id via '::' convention. I don't think we actually need this as a separate parm
  async get(session, source, type, id, opts={}) {
    if (source !== localHubSource) {
      throw new Error(`You specified the source: '${source}' in Searchers.get(). Currently the cardstack hub does not support non-local hub sources.`);
    }

    let { includePaths, format } = opts;

    let { resource, meta, included } = await this.getResourceAndMeta(session, type, id);
    let authorizedResult;
    let documentContext;
    if (resource) {
      let schema = await this.currentSchema.getSchema();
      documentContext = this.createDocumentContext({
        id,
        type,
        schema,
        format,
        includePaths,
        upstreamDoc: { data: resource, meta, included }
      });
      authorizedResult = await documentContext.applyReadAuthorization({ session, type, id });
    }

    if (!authorizedResult) {
      throw new Error(`No such resource ${type}/${id}`, {
        status: 404
      });
    }

    return authorizedResult;
  }

  async getBinary(session, source, packageName, cardId, type, modelId, opts={}) {
    // look up authorized result to check read is authorized by going through
    // the default auth stack for the JSON representation. Error will be thrown
    // if authorization is not correct.
    let { version } = opts;

    // TODO this needs to get the card's internal model that backs the binary data.
    // this.get() will ultimately be the incorrect place to retrieve this from...
    let document = await this.get(session, source, type, modelId, { version });

    // TODO ultimately there will be no need to look up the source as it is being provided
    // as an argument to this method.
    let sourceId = document.data.meta.source;
    let sources = await this._lookupSources();

    // we don't need to take a middleware-like approach here because we already
    // searched for the json representation, so we know exactly what data source
    // to get the binary blob from
    let dataSource = sources.find(s => s.id === sourceId);

    let sessionOrEveryone = session || Session.EVERYONE;
    let result = await dataSource.searcher.getBinary(sessionOrEveryone, type, modelId);

    return [result, document];
  }

  async search(session, query, opts={}) {
    if (typeof query !== 'object') {
      throw new Error(`Searchers.search() expects parameters: 'session', 'query'`);
    }

    let schemaPromise = this.currentSchema.getSchema();
    let sessionOrEveryone = session || Session.EVERYONE;

    let { format } = opts;
    let result = await this._search(sessionOrEveryone)(query);
    if (result) {
      let schema = await schemaPromise;
      let includePaths = (get(query, 'include') || '').split(',');
      let documentContext = this.createDocumentContext({
        schema,
        format,
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

  createDocumentContext({ schema, type, id, sourceId, generation, upstreamDoc, format, includePaths }) {
    return new DocumentContext({
      schema,
      type,
      id,
      sourceId,
      format,
      generation,
      upstreamDoc,
      includePaths,
      routers: this._getRouters(),
      read: this._read(),
      search: this._search(Session.INTERNAL_PRIVILEGED)
    });
  }

  _read() {
    return async (type, id) => {
      let document;
      try {
        let { resource:data, included } = (await this.getResourceAndMeta(Session.INTERNAL_PRIVILEGED, type, id));
        document = { data, included };
      } catch (err) {
        if (err.status !== 404) { throw err; }
      }
      return document.data ? document : null;
    };
  }


  _search(session) {
    return async (query) => {
      let sources = await this._lookupSources();
      let index = 0;

      let next = async () => {
        let source = sources[index++];
        if (source) {
          let response = await source.searcher.search(session, query, next);
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
      return next();
    };
  }

  async _setupWorkers() {
    if (this._workersSetup) { return; }

    this._workersSetup = true;
    await this.jobQueue.subscribe("hub/searchers/cache", async ({ data: { maxAge, upstreamDoc } }) => {
      this._cachingPromise = Promise.resolve(this._cachingPromise)
        .then(() => this._cacheDocument(upstreamDoc, maxAge));
      return await this._cachingPromise;
    });
  }

  async _startCacheJob(upstreamDoc, maxAge) {
    await this._setupWorkers();

    await this.jobQueue.publishAndWait('hub/searchers/cache',
      { upstreamDoc, maxAge },
      { singletonKey: 'hub/searchers/cache', singletonNextSlot: true }
    );
  }

  async _cacheDocument(upstreamDoc, maxAge) {
    let { data: { id, type } } = upstreamDoc;
    let schema = await this.currentSchema.getSchema();
    let documentContext = this.createDocumentContext({
      id,
      type,
      schema,
      upstreamDoc: upstreamDoc
    });

    let batch = this.client.beginBatch(await this.currentSchema.getSchema(), this);
    try {
      await batch.saveDocument(documentContext, { maxAge });
    } finally {
      await batch.done();
    }
  }

});
