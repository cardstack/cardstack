/*
  Indexer deals with indexing documents. Its public API is

    `update`: responsible for getting any new upstream content into
      the search index. update takes these optional arguments:

      - forceRefresh: when true, we will force elasticsearch to index
        the new content immediately. This is expensive if you do it
        too often. When false, we will wait for the next scheduled
        refresh to happen (the default Elasticsearch refresh_interval
        is once per second). Defaults to false.

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

const EventEmitter = require('events');
const { flatten, uniqBy } = require('lodash');
const log = require('@cardstack/logger')('cardstack/indexers');
const Client = require('@cardstack/elasticsearch/client');
const { declareInjections } = require('@cardstack/di');
const toJSONAPI = require('@cardstack/elasticsearch/to-jsonapi');
const bootstrapSchema = require('./bootstrap-schema');

const owningDataSource = new WeakMap();

module.exports = declareInjections({
  schemaLoader: 'hub:schema-loader',
  seedModels: 'config:seed-models'
},

class Indexers {
  constructor() {
    this._clientMemo = null;
    this._running = false;
    this._queue = [];
    this._forceRefreshQueue = [];
    this._seedSchemaMemo = null;
    this._schemaCache = null;
    this.events = new EventEmitter();
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

  async update({ forceRefresh, hints } = {}) {
    let resolve, reject;
    let promise = new Promise((r,j) => {
      resolve = r;
      reject = j;
    });
    if (forceRefresh) {
      this._forceRefreshQueue.push({ hints, resolve, reject });
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
      while (this._queue.length > 0 || this._forceRefreshQueue.length > 0) {
        let queue = this._queue;
        this._queue = [];
        try {
          await this._runBatch(queue, false);
        } catch (err) {
          queue.forEach(req => req.reject(err));
          throw err;
        }
        let forceRefreshQueue = this._forceRefreshQueue;
        this._forceRefreshQueue = [];
        try {
          await this._runBatch(forceRefreshQueue, true);
        } catch (err) {
          forceRefreshQueue.forEach(req => req.reject(err));
          throw err;
        }
      }
    } finally {
      this._running = false;
    }
  }

  async _runBatch(batch, forceRefresh) {
    if (batch.length > 0) {
      let hints;
      // hints only help if every request in the batch has hints. A
      // request with no hints means "index everything" anyway.
      if (batch.every(req => req.hints)) {
        hints = batch.map(req => req.hints).reduce((a,b) => a.concat(b));
      }
      await this._doUpdate(forceRefresh, hints);
      for (let { resolve } of batch) {
        resolve();
      }
    }
  }

  async _doUpdate(forceRefresh, hints) {
    log.debug('begin update, forceRefresh=%s', forceRefresh);
    let priorCache = this._schemaCache;
    let running = new RunningIndexers(await this._seedSchema(), await this._client());
    try {
      let schemas = await running.update(forceRefresh, hints);
      if (this._schemaCache === priorCache) {
        this._schemaCache = Promise.resolve(schemas);
      }
    } finally {
      running.destroy();
    }
    this.events.emit('index_update');
    log.debug('end update, forceRefresh=%s', forceRefresh);
  }

});
