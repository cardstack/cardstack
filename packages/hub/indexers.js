/*
  Indexer deals with indexing documents. It's public API is just
  `update`, which is responsible for getting any new upstream content
  into the search index.

  update takes these optional arguments:

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

*/

const log = require('@cardstack/plugin-utils/logger')('indexers');
const Client = require('@cardstack/elasticsearch/client');
const { declareInjections } = require('@cardstack/di');
const { uniqBy } = require('lodash');
const owningDataSource = new WeakMap();

require('./diff-log-formatter');

module.exports = declareInjections({
  schemaCache: 'hub:schema-cache',
  searchers: 'hub:searchers'
},

class Indexers {
  constructor() {
    this.client = null;
    this._lastControllingSchema = null;
    this._seenBranches = new Map();
    this._indexers = null;
    this._running = false;
    this._queue = [];
    this._realTimeQueue = [];
  }

  async update({ realTime, hints } = {}) {
    let resolve, reject;
    let promise = new Promise((r,j) => {
      resolve = r;
      reject = j;
    });
    await this._ensureClient();
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

  async _ensureClient() {
    if (!this.client) {
      this.client = await Client.create();
    }
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
    let branches = await this._branches(hints);
    try {
      await Promise.all(Object.keys(branches).map(
        branchName => this._updateBranch(branchName, branches[branchName], realTime, hints)
      ));
    } finally {
      Object.values(branches).map(updaters => updaters.forEach(updater => {
        if (typeof updater.destroy === 'function') {
          updater.destroy();
        }
      }));
    }
    log.debug('end update, realTime=%s', realTime);
  }

  async _updateBranch(branch, updaters, realTime, hints) {
    let branchUpdater = new BranchUpdate(branch, updaters, realTime, hints, !this._seenBranches.has(branch), this.client, this.schemaCache, this.searchers);
    let token = this.schemaCache.prepareBranchUpdate(branch);
    let schema = await branchUpdater.run();
    this._seenBranches.set(branch, true);
    this.schemaCache.notifyBranchUpdate(branch, schema, token);
  }

  async _lookupIndexers() {
    let schema = await this.schemaCache.schemaForControllingBranch();
    if (schema !== this._lastControllingSchema) {
      this._lastControllingSchema = schema;
      this._indexers = [...schema.dataSources.values()].map(v => {
        if (v.indexer) {
          owningDataSource.set(v.indexer, v);
          return v.indexer;
        }
      }).filter(Boolean);
      log.debug('found %s indexers', this._indexers.length);
    }
    return this._indexers;
  }

  async _branches() {
    let indexers = await this._lookupIndexers();
    let branches = {};
    await Promise.all(indexers.map(async indexer => {
      for (let branch of await indexer.branches()) {
        if (!branches[branch]) {
          branches[branch] = [];
        }
        let updater = await indexer.beginUpdate(branch);
        owningDataSource.set(updater, owningDataSource.get(indexer));
        branches[branch].push(updater);
      }
    }));
    return branches;
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

class BranchUpdate {
  constructor(branch, updaters, realTime, hints, shouldIndexSeeds, client, schemaCache, searchers) {
    this.branch = branch;
    this.updaters = updaters;
    this.hints = hints;
    this.schema = null;
    this.bulkOps = client.bulkOps({ realTime });
    this.shouldIndexSeeds = shouldIndexSeeds;
    this.client = client;
    this.schemaCache = schemaCache;
    this.searchers = searchers;
    this._touched = Object.create(null);
  }

  async run() {
    this.schema = await this._updateSchema();
    await this.client.accomodateSchema(this.branch, this.schema);
    await this._updateContent();
    return this.schema;
  }

  async _updateSchema() {
    let models = [];
    for (let updater of this.updaters) {
      models = models.concat(await updater.schema());
    }
    return this.schemaCache.schemaFrom(models);
  }

  async _updateContent() {
    if (this.shouldIndexSeeds) {
      let publicOps = Operations.create(this, '__cardstack_seed_models__');
      await this.schemaCache.indexBaseContent(publicOps);
    }
    for (let updater of this.updaters) {
      let meta = await this._loadMeta(updater);
      let sourceId = owningDataSource.get(updater).id;
      let publicOps = Operations.create(this, sourceId);
      let newMeta = await updater.updateContent(meta, this.hints, publicOps);
      await this._saveMeta(updater, newMeta);
    }
    await this._invalidations();
    await this.bulkOps.finalize();
  }

  async _loadMeta(updater) {
    return this.client.es.getSource({
      index: Client.branchToIndexName(this.branch),
      type: 'meta',
      id: owningDataSource.get(updater).id,
      ignore: [404]
    });
  }

  async _saveMeta(updater, newMeta) {
    await this.bulkOps.add({
      index: {
        _index: Client.branchToIndexName(this.branch),
        _type: 'meta',
        _id: owningDataSource.get(updater).id,
      }
    }, newMeta);
  }

  // This method does not need to recursively invalidate, because each
  // document stores a complete, rolled-up picture of which other
  // documents it references.
  async _invalidations() {
    let filter = {
      cardstack_references: Object.keys(this._touched)
    };
    let result = await this.searchers.search(this.branch, { filter, page: { size: 100 } });
    let pendingOps = [];
    for (let { type, id } of result.data) {
      let key = `${type}/${id}`;
      if (!this._touched[key]) {
        this._touched[key] = true;
        pendingOps.push((async ()=> {
          let resource = await this.read(type, id);
          if (resource) {
            let sourceId = this.schema.types.get(type).dataSource.id;
            let nonce = 0;
            await this.add(type, id, resource, sourceId, nonce);
          }
        })());
      }
    }
    await Promise.all(pendingOps);
  }

  async read(type, id) {
    let contentType = this.schema.types.get(type);
    if (!contentType) { return; }
    let source = contentType.dataSource;
    if (!source) { return; }
    let updater = this.updaters.find(u => {
      let s = owningDataSource.get(u);
      return s && s.id === source.id;
    });
    if (!updater) { return; }
    return updater.read(type, id, this.schema.isSchemaType(type));
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
        let field = this.schema.fields.get(attribute);
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
        searchTree = this.schema.types.get(type).includesTree;
      }

      for (let attribute of Object.keys(jsonapiDoc.relationships)) {
        let value = jsonapiDoc.relationships[attribute];
        let field = this.schema.fields.get(attribute);
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
    if (parentsIncludes) {
      parentsIncludes.push(pristine.data);
    } else {
      searchDoc.cardstack_pristine = pristine;
      searchDoc.cardstack_references = ourReferences;
    }
    return searchDoc;
  }


}
