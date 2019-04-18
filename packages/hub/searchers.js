const { declareInjections } = require('@cardstack/di');
const log = require('@cardstack/logger')('cardstack/searchers');
const Error = require('@cardstack/plugin-utils/error');
const Session = require('@cardstack/plugin-utils/session');
const { isCard, cardIdFromId, cardContextFromId } = require('@cardstack/plugin-utils/card-context');
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

  get ownTypes() {
    if (this._ownTypes) { this._ownTypes; }

    let schemaLoader = this.__owner__.lookup('hub:schema-loader');
    this._ownTypes = schemaLoader.ownTypes();
    return this._ownTypes;
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

  // TODO this API changed, make sure to update all callers (including @cardstack/ethereum)
  async getResourceAndMeta({ session, sourceId, packageName, cardId, type, modelId, snapshotVersion }) {
    let sources = await this._getSources(sourceId);
    let index = 0;
    let sessionOrEveryone = session || Session.EVERYONE;
    let next = async () => {
      let source = sources[index++];
      if (source) {
        let response = await source.searcher.get({ session:sessionOrEveryone, sourceId, packageName, cardId, type, modelId, snapshotVersion, next });
        if (response && response.data) {
          if (!response.data.meta) {
            response.data.meta = {};
          }
          if (response.data.meta.source == null) {
            response.data.meta.source = sourceId;
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

  async get(session, sourceId, packageName, cardId, opts={}) {
    let { version:snapshotVersion, includePaths } = opts;

    let { resource, meta, included } = await this.getResourceAndMeta({ session, sourceId, packageName, cardId, snapshotVersion });
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
      throw new Error(`No such resource ${sourceId}/${packageName}/${cardId}`, {
        status: 404
      });
    }

    return authorizedResult;
  }

  // TODO make sure to update callers to pass in the source ID for realz
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
    let [ dataSource ] = await this._getSources(sourceId);

    let sessionOrEveryone = session || Session.EVERYONE;
    let result = await dataSource.searcher.getBinary({ session: sessionOrEveryone, type, modelId });

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
      let {
        sourceId,
        packageName,
        modelId,
        snapshotVersion
      } = cardContextFromId(id);

      let document;
      try {
        document = await this.getResourceAndMeta({
          session: Session.INTERNAL_PRIVILEGED,
          sourceId,
          packageName,
          cardId: cardIdFromId(id),
          type,
          modelId,
          snapshotVersion
        });
      } catch (err) {
        if (err.status !== 404) { throw err; }
      }

      let { included=[], resource } = document || {};

      if (!isCard(type)) {
        return resource;
      }

      // This assumes we are using the strategy storing a card for each row in our index.
      // if an internal model was being requested, we need to pluck that out of the card's includeds

      return included.find(i => i.type === type && i.id === id);
    };
  }

  _readUpstreamCard() {
    return async (id) => {
      let {
        sourceId,
        packageName,
      } = cardContextFromId(id);
      let card;
      try {
        card = await this.client.readUpstreamDocument({ sourceId, packageName, id });
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
          let response = await source.searcher.search({ session, query, next });
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
