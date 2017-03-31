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
require('./diff-log-formatter');

module.exports = class Indexers {
  constructor(schemaCache) {
    this.schemaCache = schemaCache;
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
      this._indexers = [...schema.dataSources.values()].map(v => v.indexer).filter(Boolean);
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
        if (updater.name == null) {
          throw new Error("index updaters must provide a name");
        }
        branches[branch].push(updater);
      }
    }));
    return branches;
  }

  async _loadMeta(branch, updater) {
    return this.client.es.getSource({
      index: Client.branchToIndexName(branch),
      type: 'meta',
      id: updater.name,
      ignore: [404]
    });
  }

  async _saveMeta(branch, updater, newMeta, privateOps) {
    await privateOps.bulkOps.add({
      index: {
        _index: Client.branchToIndexName(branch),
        _type: 'meta',
        _id: updater.name,
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
    let { publicOps, privateOps } = Operations.create(this.client.es, branch, schema, realTime, this.log);
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

};

function jsonapiDocToSearchDoc(jsonapiDoc, schema) {
  let searchDoc = {};
  let relNames = [];
  let derivedNames = [];
  if (jsonapiDoc.attributes) {
    for (let attribute of Object.keys(jsonapiDoc.attributes)) {
      let value = jsonapiDoc.attributes[attribute];
      let field = schema.fields.get(attribute);
      if (field) {
        let derivedFields = field.derivedFields(value);
        if (derivedFields) {
          for (let [derivedName, derivedValue] of Object.entries(derivedFields)) {
            searchDoc[derivedName] = derivedValue;
            derivedNames.push(derivedName);
          }
        }
      }
      searchDoc[attribute] = value;
    }
  }
  if (jsonapiDoc.relationships) {
    for (let attribute of Object.keys(jsonapiDoc.relationships)) {
      let value = jsonapiDoc.relationships[attribute];
      searchDoc[attribute] = value;
      relNames.push(attribute);
    }
  }

  // The next two fields in the searchDoc get a "cardstack_" prefix so
  // they aren't likely to collide with the user's attribute or
  // relatioship names.
  if (jsonapiDoc.meta) {
    searchDoc.cardstack_meta = jsonapiDoc.meta;
  }
  searchDoc.cardstack_rel_names = relNames;
  searchDoc.cardstack_derived_names = derivedNames;
  return searchDoc;
}

const opsPrivate = new WeakMap();

class Operations {
  static create(es, branch, schema, realTime, log) {
    let publicOps = new this(es, branch, schema, realTime, log);
    let privateOps = opsPrivate.get(publicOps);
    return { publicOps, privateOps };
  }

  constructor(es, branch, schema, realTime, log) {
    opsPrivate.set(this, {
      schema,
      log,
      branch,
      bulkOps: new BulkOps(es, { realTime }),
      flush() {
        return this.bulkOps.flush();
      }
    });
  }
  async save(type, id, doc){
    let { bulkOps, branch, log, schema } = opsPrivate.get(this);
    let searchDoc = jsonapiDocToSearchDoc(doc, schema);
    await bulkOps.add({
      index: {
        _index: Client.branchToIndexName(branch),
        _type: type,
        _id: id,
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
        _id: id
      }
    });
    log.debug("delete %s %s", type, id);
  }
}
