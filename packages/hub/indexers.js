/*
  Indexer deals with indexing documents. Its public API is

    `update`: responsible for getting any new upstream content into
      the search index. update takes these optional arguments:

      - realTime: when true, update will block until the resulting
        changes are visible in elasticsearch. This is somewhat
        expensive, which is why we make it optional. Most of the time
        non-realtime is good enough and much faster. Defaults to false.

      - hints: can contain a list of `{ branch, id, type }`
        references. This is intended as an optimization hint when we
        know that certain resources are the ones that likely need to be
        indexed right away. Indexers are responsible for discovering and
        indexing arbitrary upstream changes regardless of this hint, but
        the hint can make it easier to keep the search index nearly
        real-time fresh.

    `schemaForBranch(branch)`: retrieves the Schema for a given
      branch. A Schema instance is computed from all the schema models
      that are discovered on a branch. Schema models are things like
      `content-types`, `fields`, `data-sources`, `plugin-configs`,
      etc. They are pieces of content, but special pieces of content
      that can alter how other content gets indexed.

      This method does it own caching, since schemas get computed as
      part of indexing anyway. You can also directly invalidate the
      cache, see next method.

    `invalidateSchemaCache()`: does what it says on the
      tin. This is a lighter-weight operation than `update`. It allows
      us to decouple the question of when and how to index content
      from the issue of maintaining schema correctness during
      sequences of writes.

*/

const log = require('@cardstack/logger')('cardstack/indexers');
const Client = require('@cardstack/elasticsearch/client');
const toJSONAPI = require('@cardstack/elasticsearch/to-jsonapi');
const { declareInjections } = require('@cardstack/di');
const { uniqBy } = require('lodash');
const owningDataSource = new WeakMap();
const bootstrapSchema = require('./bootstrap-schema');
const { flatten } = require('lodash');

module.exports = declareInjections({
  schemaLoader: 'hub:schema-loader',
  seedModels: 'config:seed-models'
},

class Indexers {
  constructor() {
    this._clientMemo = null;
    this._running = false;
    this._queue = [];
    this._realTimeQueue = [];
    this._seedSchemaMemo = null;
    this._schemaCache = null;
  }

  async schemaForBranch(branch) {
    if (!this._schemaCache) {
      this._schemaCache = (async () => {
        let running = new RunningIndexers(await this._seedSchema(), await this._client());
        try {
          return await running.schemas();
        } finally {
          running.destroy();
        }
      })();
    }
    return (await this._schemaCache)[branch];
  }

  invalidateSchemaCache() {
    if (this._schemaCache) {
      this._schemaCache.then(cache => {
        for (let schema of Object.values(cache)) {
          schema.teardown();
        }
      });
    }
    this._schemaCache = null;
  }

  static teardown(instance) {
    instance.invalidateSchemaCache();
    if (instance._seedSchemaMemo) {
      instance._seedSchemaMemo.teardown();
    }
  }

  async update({ realTime, hints } = {}) {
    let resolve, reject;
    let promise = new Promise((r,j) => {
      resolve = r;
      reject = j;
    });
    if (realTime) {
      this._realTimeQueue.push({ hints, resolve, reject });
    } else {
      this._queue.push({ hints, resolve, reject });
    }
    if (!this._running) {
      this._updateLoop().then(() => {
        log.debug("Update loop finished");
      }, err => {
        log.error("Unexpected error in _updateLoop %s", err);
      });
    } else {
      log.debug("Joining update loop");
    }
    await promise;
  }

  async _client() {
    if (!this._clientMemo) {
      this._clientMemo = await Client.create();
    }
    return this._clientMemo;
  }

  async _seedSchema() {
    if (!this._seedSchemaMemo) {
      let types = this.schemaLoader.ownTypes();
      this._seedSchemaMemo = await this.schemaLoader.loadFrom(bootstrapSchema.concat(this.seedModels.filter(model => types.includes(model.type))));
    }
    return this._seedSchemaMemo;
  }

  async _updateLoop() {
    this._running = true;
    try {
      while (this._queue.length > 0 || this._realTimeQueue.length > 0) {
        let queue = this._queue;
        this._queue = [];
        try {
          await this._runBatch(queue, false);
        } catch (err) {
          queue.forEach(req => req.reject(err));
          throw err;
        }
        let realTimeQueue = this._realTimeQueue;
        this._realTimeQueue = [];
        try {
          await this._runBatch(realTimeQueue, true);
        } catch (err) {
          realTimeQueue.forEach(req => req.reject(err));
          throw err;
        }
      }
    } finally {
      this._running = false;
    }
  }

  async _runBatch(batch, realTime) {
    if (batch.length > 0) {
      let hints;
      // hints only help if every request in the batch has hints. A
      // request with no hints means "index everything" anyway.
      if (batch.every(req => req.hints)) {
        hints = batch.map(req => req.hints).reduce((a,b) => a.concat(b));
      }
      await this._doUpdate(realTime, hints);
      for (let { resolve } of batch) {
        resolve();
      }
    }
  }

  async _doUpdate(realTime, hints) {
    log.debug('begin update, realTime=%s', realTime);
    let priorCache = this._schemaCache;
    let running = new RunningIndexers(await this._seedSchema(), await this._client());
    try {
      let schemas = await running.update(realTime, hints);
      if (this._schemaCache === priorCache) {
        this._schemaCache = Promise.resolve(schemas);
      }
    } finally {
      running.destroy();
    }
    log.debug('end update, realTime=%s', realTime);
  }

});


const opsPrivate = new WeakMap();


class Operations {
  static create(branchUpdate, sourceId) {
    return new this(branchUpdate, sourceId);
  }

  constructor(branchUpdate, sourceId) {
    opsPrivate.set(this, {
      sourceId,
      branchUpdate,
      nonce: null
    });
  }
  async save(type, id, doc){
    let { sourceId, branchUpdate, nonce } = opsPrivate.get(this);
    await branchUpdate.add(type, id, doc, sourceId, nonce);
  }
  async delete(type, id) {
    let { branchUpdate } = opsPrivate.get(this);
    await branchUpdate.delete(type, id);
  }
  async beginReplaceAll() {
    opsPrivate.get(this).nonce = Math.floor(Number.MAX_SAFE_INTEGER * Math.random());
  }
  async finishReplaceAll() {
    let { branchUpdate, sourceId, nonce } = opsPrivate.get(this);
    if (!nonce) {
      throw new Error("tried to finishReplaceAll when there was no beginReplaceAll");
    }
    await branchUpdate.deleteAllWithoutNonce(sourceId, nonce);
  }
}

class RunningIndexers {
  constructor(seedSchema, client) {
    this.seedSchema = seedSchema;
    this.client = client;
    this.seenDataSources = {};
    this.branches = {};
  }

  destroy() {
    for (let branchUpdate of Object.values(this.branches)) {
      branchUpdate.destroy();
    }
  }

  _findIndexer(dataSource) {
    if (dataSource.indexer) {
      owningDataSource.set(dataSource.indexer, dataSource);
      this.seenDataSources[dataSource.id] = true;
      return dataSource.indexer;
    }
  }

  async _loadSchemas() {
    let newIndexers = [...this.seedSchema.dataSources.values()]
        .map(this._findIndexer.bind(this))
        .filter(Boolean);
    while (newIndexers.length > 0) {
      let dirtyBranches = await this._activateIndexers(newIndexers);
      newIndexers = [];
      await Promise.all(dirtyBranches.map(async branch => {
        let schema = await this.branches[branch].schema();
        for (let dataSource of schema.dataSources.values()) {
          if (!this.seenDataSources[dataSource.id]) {
            let indexer = this._findIndexer(dataSource);
            if (indexer) {
              newIndexers.push(dataSource.indexer);
            }
          }
        }
      }));
    }
  }

  async _activateIndexers(indexers) {
    let dirtyBranches = {};
    await Promise.all(indexers.map(async indexer => {
      for (let branch of await indexer.branches()) {
        dirtyBranches[branch] = true;
        if (!this.branches[branch]) {
          this.branches[branch] = new BranchUpdate(branch, this.seedSchema, this.client);
        }
        await this.branches[branch].addIndexer(indexer);
      }
    }));
    return Object.keys(dirtyBranches);
  }

  async update(realTime, hints) {
    await this._loadSchemas();
    await Promise.all(Object.values(this.branches).map(branch => branch.update(realTime, hints)));
    return await this._schemas();
  }

  async schemas() {
    await this._loadSchemas();
    return await this._schemas();
  }

  async _schemas() {
    let schemas = Object.create(null);
    for (let [branch, branchUpdate] of Object.entries(this.branches)) {
      schemas[branch] = await branchUpdate.schema();
    }
    return schemas;
  }
}

class BranchUpdate {
  constructor(branch, seedSchema, client) {
    this.branch = branch;
    this.seedSchema = seedSchema;
    this.client = client;
    this.updaters = Object.create(null);
    this.schemaModels = [];
    this._schema = null;
    this.bulkOps = null;
    this._touched = Object.create(null);
  }

  async addIndexer(indexer) {
    if (this._schema) {
      this._schema.teardown();
      this._schema = null;
    }
    let updater = await indexer.beginUpdate(this.branch, this._readOtherIndexers.bind(this));
    let dataSource = owningDataSource.get(indexer);
    owningDataSource.set(updater, dataSource);
    this.schemaModels.push(await updater.schema());
    this.updaters[dataSource.id] = updater;
  }

  async _readOtherIndexers(type, id) {
    if (!this._schema) {
      throw new Error("Not allowed to readOtherIndexers until your own updateContent() hook. You're trying to use it before all the other indexers have had a chance to activate.");
    }
    return this.read(type, id);
  }

  async schema() {
    if (!this._schema) {
      this._schema = await this.seedSchema.applyChanges(flatten(this.schemaModels).map(model => ({ type: model.type, id: model.id, document: model })));
    }
    return this._schema;
  }

  destroy() {
    if (this._schema) {
      this._schema.teardown();
    }
    for (let updater of Object.values(this.updaters)) {
      if (typeof updater.destroy === 'function') {
        updater.destroy();
      }
    }
  }

  async update(realTime, hints) {
    this.bulkOps = this.client.bulkOps({ realTime });
    await this.client.accomodateSchema(this.branch, await this.schema());
    await this._updateContent(hints);
  }

  async _updateContent(hints) {
    for (let [sourceId, updater] of Object.entries(this.updaters)) {
      let meta = await this._loadMeta(updater);
      let publicOps = Operations.create(this, sourceId);
      let newMeta = await updater.updateContent(meta, hints, publicOps);
      await this._saveMeta(updater, newMeta);
    }
    await this._invalidations();
    await this.bulkOps.finalize();
  }

  async _loadMeta(updater) {
    let doc = await this.client.es.getSource({
      index: Client.branchToIndexName(this.branch),
      type: 'meta',
      id: owningDataSource.get(updater).id,
      ignore: [404]
    });
    if (doc) {
      return doc.params;
    }
  }

  async _saveMeta(updater, newMeta) {
    // the plugin-specific metadata is wrapped inside a "params"
    // property so that we can tell elasticsearch not to index any of
    // it. We don't want inconsistent types across plugins to cause
    // mapping errors.
    await this.bulkOps.add({
      index: {
        _index: Client.branchToIndexName(this.branch),
        _type: 'meta',
        _id: owningDataSource.get(updater).id,
      }
    }, { params: newMeta });
  }

  async _findTouchedReferences() {
    let size = 100;
    let esBody = {
      query: {
        bool: {
          must: [
            { terms: { cardstack_references : Object.keys(this._touched) } }
          ],
        }
      },
      size
    };

    let result = await this.client.es.search({
      index: Client.branchToIndexName(this.branch),
      body: esBody
    });

    let docs = result.hits.hits;
    if (docs.length === size) {
      throw new Error("Bug in hub:indexers: need to process larger invalidation sets");
    }
    return docs.map(doc => toJSONAPI(doc._type, doc._source).data);
  }

  // This method does not need to recursively invalidate, because each
  // document stores a complete, rolled-up picture of which other
  // documents it references.
  async _invalidations() {
    let schema = await this.schema();
    let pendingOps = [];
    let references = await this._findTouchedReferences();
    for (let { type, id } of references) {
      let key = `${type}/${id}`;
      if (!this._touched[key]) {
        this._touched[key] = true;
        pendingOps.push((async ()=> {
          let resource = await this.read(type, id);
          if (resource) {
            let sourceId = schema.types.get(type).dataSource.id;
            let nonce = 0;
            await this.add(type, id, resource, sourceId, nonce);
          }
        })());
      }
    }
    await Promise.all(pendingOps);
  }

  async read(type, id) {
    let schema = await this.schema();
    let contentType = schema.types.get(type);
    if (!contentType) { return; }
    let source = contentType.dataSource;
    if (!source) { return; }
    let updater = this.updaters[source.id];
    if (!updater) { return; }
    let isSchemaType = schema.isSchemaType(type);
    let model = await updater.read(type, id, isSchemaType);
    if (!model) {
      // The seeds can provide any type of model, so if we're not
      // finding something, we should also fallback to checking in
      // seeds.
      let seedUpdater = this.updaters['seeds'];
      if (seedUpdater) {
        model = await seedUpdater.read(type, id, isSchemaType);
      }
    }
    return model;
  }

  async add(type, id, doc, sourceId, nonce) {
    this._touched[`${type}/${id}`] = true;
    let searchDoc = await this._prepareSearchDoc(type, id, doc);
    searchDoc.cardstack_source = sourceId;
    if (nonce) {
      searchDoc.cardstack_generation = nonce;
    }
    await this.bulkOps.add({
      index: {
        _index: Client.branchToIndexName(this.branch),
        _type: type,
        _id: `${this.branch}/${id}`,
      }
    }, searchDoc);
    log.debug("save %s %s", type, id);
  }

  async delete(type, id) {
    this._touched[`${type}/${id}`] = true;
    await this.bulkOps.add({
      delete: {
        _index: Client.branchToIndexName(this.branch),
        _type: type,
        _id: `${this.branch}/${id}`
      }
    });
    log.debug("delete %s %s", type, id);
  }

  async deleteAllWithoutNonce(sourceId, nonce) {
    await this.bulkOps.add('deleteByQuery', {
      index: Client.branchToIndexName(this.branch),
      conflicts: 'proceed',
      body: {
        query: {
          bool: {
            must: [
              { term: { cardstack_source: sourceId } },
            ],
            must_not: [
              { term: { cardstack_generation: nonce } }
            ]
          }
        }
      }
    });
    log.debug("bulk delete older content for data source %s", sourceId);
  }


  async _prepareSearchDoc(type, id, jsonapiDoc, searchTree, parentsIncludes, parentsReferences) {
    let schema = await this.schema();

    // we store the id as a regular field in elasticsearch here, because
    // we use elasticsearch's own built-in _id for our own composite key
    // that takes into account branches.
    //
    // we don't store the type as a regular field in elasticsearch,
    // because we're keeping it in the built in _type field.
    let esId = await this.client.logicalFieldToES(this.branch, 'id');
    let searchDoc = { [esId]: id };

    // this is the copy of the document we will return to anybody who
    // retrieves it. It's supposed to already be a correct jsonapi
    // response, as opposed to the searchDoc itself which is mangled
    // for searchability.
    let pristine = {
      data: { id, type }
    };

    // we are going inside a parent document's includes, so we need
    // our own type here.
    if (parentsIncludes) {
      let esType = await this.client.logicalFieldToES(this.branch, 'type');
      searchDoc[esType] = type;
    }

    // ourIncludes will track related resources that we successfully
    // included. ourReferences also includes broken references. We
    // track the references for our invalidation system.
    let ourIncludes, ourReferences;
    if (parentsIncludes) {
      ourIncludes = parentsIncludes;
      ourReferences = parentsReferences;
    } else {
      ourIncludes = [];
      ourReferences = [];
    }

    if (jsonapiDoc.attributes) {
      pristine.data.attributes = jsonapiDoc.attributes;
      for (let attribute of Object.keys(jsonapiDoc.attributes)) {
        let value = jsonapiDoc.attributes[attribute];
        let field = schema.fields.get(attribute);
        if (field) {
          let derivedFields = field.derivedFields(value);
          if (derivedFields) {
            for (let [derivedName, derivedValue] of Object.entries(derivedFields)) {
              let esName = await this.client.logicalFieldToES(this.branch, derivedName);
              searchDoc[esName] = derivedValue;
            }
          }
        }
        let esName = await this.client.logicalFieldToES(this.branch, attribute);
        searchDoc[esName] = value;
      }
    }
    if (jsonapiDoc.relationships) {
      let relationships = pristine.data.relationships = Object.assign({}, jsonapiDoc.relationships);

      if (!searchTree) {
        // we are the root document, so our own configured default
        // includes determines which relationships to recurse into
        searchTree = schema.types.get(type).includesTree;
      }

      for (let attribute of Object.keys(jsonapiDoc.relationships)) {
        let value = jsonapiDoc.relationships[attribute];
        let field = schema.fields.get(attribute);
        if (field && value && value.hasOwnProperty('data')) {
          let related;
          if (value.data && searchTree[attribute]) {
            if (Array.isArray(value.data)) {
              related = await Promise.all(value.data.map(async ({ type, id }) => {
                ourReferences.push(`${type}/${id}`);
                let resource = await this.read(type, id);
                if (resource) {
                  return this._prepareSearchDoc(type, id, resource, searchTree[attribute], ourIncludes, ourReferences);
                }
              }));
              related = related.filter(Boolean);
              relationships[attribute] = Object.assign({}, relationships[attribute], { data: related.map(r => ({ type: r.type, id: r.id })) });
            } else {
              ourReferences.push(`${value.data.type}/${value.data.id}`);
              let resource = await this.read(value.data.type, value.data.id);
              if (resource) {
                related = await this._prepareSearchDoc(resource.type, resource.id, resource, searchTree[attribute], ourIncludes, ourReferences);
              } else {
                relationships[attribute] = Object.assign({}, relationships[attribute], { data: null });
              }

            }
          } else {
            related = value.data;
          }
          let esName = await this.client.logicalFieldToES(this.branch, attribute);
          searchDoc[esName] = related;
        }
      }

      if (ourIncludes.length > 0 && !parentsIncludes) {
        pristine.included = uniqBy([pristine].concat(ourIncludes), r => `${r.type}/${r.id}`).slice(1);
      }
    }

    // The next fields in the searchDoc get a "cardstack_" prefix so
    // they aren't likely to collide with the user's attribute or
    // relationship.

    if (jsonapiDoc.meta) {
      searchDoc.cardstack_meta = jsonapiDoc.meta;
      pristine.data.meta = jsonapiDoc.meta;
    }

    let contentType = schema.types.get(type);
    if (contentType) {
      searchDoc.cardstack_resource_realms = contentType.realms.resourceReaders(jsonapiDoc);
    } else {
      searchDoc.cardstack_resource_realms = [];
    }

    if (parentsIncludes) {
      parentsIncludes.push(pristine.data);
    } else {
      searchDoc.cardstack_pristine = pristine;
      searchDoc.cardstack_references = ourReferences;
    }
    return searchDoc;
  }

}
