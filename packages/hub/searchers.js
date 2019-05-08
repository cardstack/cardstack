const { declareInjections } = require('@cardstack/di');
const log = require('@cardstack/logger')('cardstack/searchers');
const Error = require('@cardstack/plugin-utils/error');
const Session = require('@cardstack/plugin-utils/session');
const { isCard } = require('@cardstack/plugin-utils/card-context');
const DocumentContext = require('./indexing/document-context');
const { get } = require('lodash');

const localHubSource = 'local-hub';

module.exports = declareInjections({
  sources: 'hub:data-sources',
  internalSearcher: `plugin-searchers:${require.resolve('@cardstack/pgsearch/searcher')}`,
  client: `plugin-client:${require.resolve('@cardstack/pgsearch/client')}`,
  currentSchema: 'hub:current-schema',
  jobQueue: 'hub:queues',
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

  async _resolveActiveSources() {
    let activeSources = await this.sources.active();
    if (activeSources !== this._lastActiveSources) {
      this._lastActiveSources = activeSources;
      this._sources = [...activeSources.values()].filter(v => v.searcher);
      this._sources.push({ searcher: this.internalSearcher });
      log.debug('found %s searchers', this._sources.length);
    }
    return this._sources;
  }

  async _getSources(sourceId) {
    let activeSources = await this._resolveActiveSources();
    let sources = [ activeSources.find(i => i.id === sourceId) ].filter(Boolean);
    sources.push({ searcher: this.internalSearcher });
    return sources;
  }

  get ownTypes() {
    if (this._ownTypes) { this._ownTypes; }

    let schemaLoader = this.__owner__.lookup('hub:schema-loader');
    this._ownTypes = schemaLoader.ownTypes();
    return this._ownTypes;
  }

  // TODO this API changed, make sure to update all callers (including @cardstack/ethereum)
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
    if (this.routers) { this.routers; }

    this.routers = this.__owner__.lookup('hub:routers');
    return this.routers;
  }

  async getSpace(session, path) {
    return await this.get(session, localHubSource, 'spaces', path);
  }

  // Note we are transitioning to a new API here.  During this transition
  // the legacy models can provide their type in place of packageName. But if you
  // are requesting a card, dont supply 'cards' as the packageName, provide the
  // package name of the card you wish to retrieve.
  async get(session, sourceId, packageName, id, opts={}) {
    let { includePaths } = opts;

    let type = packageName;
    // Since 'packageName' is part of our API here, that actually limits callers getting documents
    // below the level of a card, as callers are not actually specifying the 'type' of the thing they want.
    // If callers want things more fine grained then cards, they should provide an includePath that can load
    // the internal models they are interested in, starting at the ['model'] path, which is the primary model
    // for the card.
    if (!this.ownTypes.includes(type) && isCard(id)) {
      type = 'cards';
    }

    // note we need to convert packageNames to types when you cross this boundary
    let { resource, meta, included } = await this.getResourceAndMeta(session, type, id);

    let authorizedResult;
    let documentContext;
    if (resource) {
      let { id, type } = resource;
      let schema = await this.currentSchema.getSchema();
      documentContext = this.createDocumentContext({
        id,
        type,
        schema,
        includePaths,
        upstreamDoc: { data: resource, meta, included }
      });
      authorizedResult = await documentContext.applyReadAuthorization({ session, type, id });
    }

    if (!authorizedResult) {
      throw new Error(`No such resource ${sourceId}/${packageName}/${id}`, {
        status: 404
      });
    }

    return authorizedResult;
  }

  async getBinary(session, source, type, id) {
    // look up authorized result to check read is authorized by going through
    // the default auth stack for the JSON representation. Error will be thrown
    // if authorization is not correct.
    let document = await this.get(session, source, type, id);

    // TODO ultimately there will be no need to look up the source as it is being provided
    // as an argument to this method.
    let sourceId = document.data.meta.source;
    let sources = await this._lookupSources();

    // we don't need to take a middleware-like approach here because we already
    // searched for the json representation, so we know exactly what data source
    // to get the binary blob from
    let dataSource = sources.find(s => s.id === sourceId);

    let sessionOrEveryone = session || Session.EVERYONE;
    let result = await dataSource.searcher.getBinary(sessionOrEveryone, type, id);

    return [result, document];
  }


  async search(session, query) {
    if (typeof query !== 'object') {
      throw new Error(`Searchers.get() expects parameters: 'session', 'query'`);
    }

    let schemaPromise = this.currentSchema.getSchema();
    let sessionOrEveryone = session || Session.EVERYONE;

    let result = await this._search(sessionOrEveryone)(query);
    if (result) {
      let schema = await schemaPromise;
      let includePaths = (get(query, 'include') || '').split(',');
      let documentContext = this.createDocumentContext({
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

  createDocumentContext({ schema, type, id, sourceId, generation, upstreamDoc, includePaths }) {
    return new DocumentContext({
      schema,
      type,
      id,
      sourceId,
      generation,
      upstreamDoc,
      includePaths,
      routers: this._getRouters(),
      read: this._read(),
      readUpstreamCard: this._readUpstreamCard(),
      search: this._search(Session.INTERNAL_PRIVILEGED)
    });
  }

  _read() {
    return async (type, id) => {
      let resource;
      try {
        resource = (await this.getResourceAndMeta(Session.INTERNAL_PRIVILEGED, type, id)).resource;
      } catch (err) {
        if (err.status !== 404) { throw err; }
      }
      return resource;
    };
  }

  _readUpstreamCard() {
    return async (id) => {
      let card;
      try {
        card = await this.client.readUpstreamDocument('cards', id);
      } catch (err) {
        if (err.status !== 404) { throw err; }
      }
      return card;
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

    let batch = this.client.beginBatch(this.currentSchema, this);
    try {
      await batch.saveDocument(documentContext, { maxAge });
    } finally {
      await batch.done();
    }
  }

});
