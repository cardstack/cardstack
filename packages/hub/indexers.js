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

const logger = require('heimdalljs-logger');
const Client = require('@cardstack/elasticsearch/client');
const BulkOps = require('./bulk-ops');
const { declareInjections } = require('@cardstack/di');
const owningDataSource = new WeakMap();

require('./diff-log-formatter');

module.exports = declareInjections({
  schemaCache: 'hub:schema-cache'
},

class Indexers {
  constructor() {
    this.client = new Client();
    this.log = logger('indexers');
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
    if (realTime) {
      this._realTimeQueue.push({ hints, resolve, reject });
    } else {
      this._queue.push({ hints, resolve, reject });
    }
    if (!this._running) {
      this._running = true;
      this._updateLoop().then(() => {
        this._running = false;
      }, err => {
        this.log.error("Unexpected error in _updateLoop %s", err);
        this._running = false;
      });
    }
    await promise;
  }

  async _updateLoop() {
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
    let branches = await this._branches(hints);
    await Promise.all(Object.keys(branches).map(
      branchName => this._updateBranch(branchName, branches[branchName], realTime, hints)
    ));
  }

  async _updateBranch(branch, updaters, realTime, hints) {
    let schema = await this._updateSchema(branch, updaters);
    await this.client.accomodateSchema(branch, schema);
    await this._updateContent(branch, updaters, schema, realTime, hints);
    this.schemaCache.notifyBranchUpdate(branch, schema);
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
      this.log.debug('found %s indexers', this._indexers.length);
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

  async _loadMeta(branch, updater) {
    return this.client.es.getSource({
      index: Client.branchToIndexName(branch),
      type: 'meta',
      id: owningDataSource.get(updater).id,
      ignore: [404]
    });
  }

  async _saveMeta(branch, updater, newMeta, privateOps) {
    await privateOps.bulkOps.add({
      index: {
        _index: Client.branchToIndexName(branch),
        _type: 'meta',
        _id: owningDataSource.get(updater).id,
      }
    }, newMeta);
  }

  async _updateSchema(branch, updaters) {
    let models = [];
    for (let updater of updaters) {
      models = models.concat(await updater.schema());
    }
    return this.schemaCache.schemaFrom(models);
  }

  async _updateContent(branch, updaters, schema, realTime, hints) {
    let { publicOps, privateOps } = Operations.create(this.client, branch, schema, realTime, this.log);
    if (!this._seenBranches.has(branch)) {
      await this.schemaCache.indexBaseContent(publicOps);
      this._seenBranches.set(branch, true);
    }
    for (let updater of updaters) {
      let meta = await this._loadMeta(branch, updater);
      let newMeta = await updater.updateContent(meta, hints, publicOps);
      await this._saveMeta(branch, updater, newMeta, privateOps);
    }
    await privateOps.flush();
  }

});

async function jsonapiDocToSearchDoc(id, jsonapiDoc, schema, branch, client) {
  // we store the id as a regular field in elasticsearch here, because
  // we use elasticsearch's own built-in _id for our own composite key
  // that takes into account branches.
  //
  // we don't store the type as a regular field in elasticsearch,
  // because we're keeping it in the built in _type field.

  let rewrites = {};
  let esId = await client.logicalFieldToES(branch, 'id');
  let searchDoc = { [esId]: id };
  if (esId !== 'id') {
    rewrites[esId] = {
      delete: false,
      rename: 'id',
      isRelationship: false
    };
  }

  if (jsonapiDoc.attributes) {
    for (let attribute of Object.keys(jsonapiDoc.attributes)) {
      let value = jsonapiDoc.attributes[attribute];
      let field = schema.fields.get(attribute);
      if (field) {
        let derivedFields = field.derivedFields(value);
        if (derivedFields) {
          for (let [derivedName, derivedValue] of Object.entries(derivedFields)) {
            let esName = await client.logicalFieldToES(branch, derivedName);
            searchDoc[esName] = derivedValue;
            rewrites[esName] = {
              delete: true,
              rename: null,
              isRelationship: false
            };
          }
        }
      }
      let esName = await client.logicalFieldToES(branch, attribute);
      searchDoc[esName] = value;
      if (esName !== attribute) {
        rewrites[esName] = {
          delete: false,
          rename: attribute,
          isRelationship: false
        };
      }
    }
  }
  if (jsonapiDoc.relationships) {
    for (let attribute of Object.keys(jsonapiDoc.relationships)) {
      let value = jsonapiDoc.relationships[attribute];
      let esName = await client.logicalFieldToES(branch, attribute);
      searchDoc[esName] = value;
      rewrites[esName] = {
        delete: false,
        rename: esName === attribute ? null : attribute,
        isRelationship: true
      };
    }
  }

  // The next fields in the searchDoc get a "cardstack_" prefix so
  // they aren't likely to collide with the user's attribute or
  // relationship.
  if (jsonapiDoc.meta) {
    searchDoc.cardstack_meta = jsonapiDoc.meta;
  }
  searchDoc.cardstack_rewrites = rewrites;
  return searchDoc;
}

const opsPrivate = new WeakMap();

class Operations {
  static create(client, branch, schema, realTime, log) {
    let publicOps = new this(client, branch, schema, realTime, log);
    let privateOps = opsPrivate.get(publicOps);
    return { publicOps, privateOps };
  }

  constructor(client, branch, schema, realTime, log) {
    opsPrivate.set(this, {
      schema,
      log,
      branch,
      client,
      bulkOps: new BulkOps(client.es, { realTime }),
      flush() {
        return this.bulkOps.flush();
      }
    });
  }
  async save(type, id, doc){
    let { bulkOps, branch, log, schema, client } = opsPrivate.get(this);
    let searchDoc = await jsonapiDocToSearchDoc(id, doc, schema, branch, client);
    await bulkOps.add({
      index: {
        _index: Client.branchToIndexName(branch),
        _type: type,
        _id: `${branch}/${id}`,
      }
    }, searchDoc);
    log.debug("save %s %s", type, id);
  }
  async delete(type, id) {
    let { bulkOps, branch, log } = opsPrivate.get(this);
    await bulkOps.add({
      delete: {
        _index: Client.branchToIndexName(branch),
        _type: type,
        _id: `${branch}/${id}`
      }
    });
    log.debug("delete %s %s", type, id);
  }
}
