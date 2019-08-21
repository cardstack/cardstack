/*
  Indexer deals with indexing documents. Its public API is

    `update`: responsible for getting any new upstream content into
      the search index. update takes these optional arguments:

      - forceRefresh: when true, we will force elasticsearch to index
        the new content immediately. This is expensive if you do it
        too often. When false, we will wait for the next scheduled
        refresh to happen (the default Elasticsearch refresh_interval
        is once per second). Defaults to false.

      - hints: can contain a list of `{ id, type }`
        references. This is intended as an optimization hint when we
        know that certain resources are the ones that likely need to be
        indexed right away. Indexers are responsible for discovering and
        indexing arbitrary upstream changes regardless of this hint, but
        the hint can make it easier to keep the search index nearly
        real-time fresh.

    `schema()`: retrieves the Schema.
      A Schema instance is computed from all the schema models
      that are discovered. Schema models are things like
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
const log = require('@cardstack/logger')('cardstack/indexers');
const { declareInjections, getOwner } = require('@cardstack/di');
const bootstrapSchema = require('./bootstrap-schema');
const RunningIndexers = require('./indexing/running-indexers');
const { schemaModelsForCard } = require('./indexing/card-schema-utils');
const { uniqBy } = require('lodash');

module.exports = declareInjections({
  schemaLoader: 'hub:schema-loader',
  dataSources: 'config:data-sources',
  client: `plugin-client:${require.resolve('@cardstack/pgsearch/client')}`,
  jobQueue: 'hub:queues'
},

class Indexers extends EventEmitter {
  constructor() {
    super();

    this._queue = [];
    this._forceRefreshQueue = [];
    this._dataSourcesMemo = null;
    this._schemaCache = null;
    this._discoveredCardSchema = [];
  }

  async schema() {
    if (!this._schemaCache) {
      this._schemaCache = (async () => {
        let running = new RunningIndexers(await this._seedSchema(), this.client, this.emit.bind(this), this.schemaLoader.ownTypes(), getOwner(this));
        try {
          let schema = await running.schemas();
          return await schema.applyChanges(this._discoveredCardSchema);
        } finally {
          await running.destroy();
        }
      })();
    }
    return await this._schemaCache;
  }

  async accomodateCard(card) {
    let cardSchema = schemaModelsForCard(await this.schema(), card);
    this._discoveredCardSchema = uniqBy(this._discoveredCardSchema.concat(cardSchema.map(document => {
      let { type, id } = document;
      return { type, id, document };
    })), i => `${i.type}/${i.id}`);

    await this.invalidateSchemaCache();
  }

  async invalidateSchemaCache() {
    if (this._schemaCache) {
      let schema = await this._schemaCache;
      await schema.teardown();
    }
    this._schemaCache = null;
  }

  static async teardown(instance) {
    await instance.invalidateSchemaCache();
    if (instance._dataSourcesMemo) {
      await instance._dataSourcesMemo.teardown();
    }
  }

  async update({ forceRefresh, hints, dontWaitForJob } = {}) {
    await this._setupWorkers();
    // Note that we dont want singletonKey, its inefficient due to the sophisticated invalidation we are using,
    // also we dont want to use singletoneNextSlot, since all the indexing calls are important (as they can have different hints, and we dont want to collapse jobs)

    if (dontWaitForJob) {
      await this.jobQueue.publish('hub/indexers/update',
        { forceRefresh, hints },
        { singletonKey: 'hub/indexers/update', singletonNextSlot: true, expireIn: '2 hours' }
      );
    } else {
      await this.jobQueue.publishAndWait('hub/indexers/update',
        { forceRefresh, hints },
        { singletonKey: 'hub/indexers/update', singletonNextSlot: true, expireIn: '2 hours' }
      );
    }
  }

  async _setupWorkers() {
    if (!this._workersSetup) {
      await this.jobQueue.subscribe("hub/indexers/update", async ({data: { forceRefresh, hints }}) => {
        await this._doUpdate(forceRefresh, hints);
      });
      this._workersSetup = true;
    }
  }

  async _seedSchema() {
    if (!this._dataSourcesMemo) {
      let types = this.schemaLoader.ownTypes();
      log.debug(`Indexers._seedSchema starting seed schema load`);
      this._dataSourcesMemo = await this.schemaLoader.loadFrom(bootstrapSchema.concat(this.dataSources.filter(model => types.includes(model.type))));
      log.debug(`Indexers._seedSchema completed loading seed schema`);
    }
    return this._dataSourcesMemo;
  }

  async _doUpdate(forceRefresh, hints) {
    log.debug('begin update, forceRefresh=%s', forceRefresh);
    let priorCache = this._schemaCache;
    let running = new RunningIndexers(await this._seedSchema(), this.client, this.emit.bind(this), this.schemaLoader.ownTypes(), getOwner(this));
    try {
      let newSchema = await running.update(forceRefresh, hints);

      if (this._schemaCache === priorCache) {
        // nobody else has done a more recent update of the schema
        // cache than us, so we can try to update it.
        if (priorCache) {
          let oldSchema = await priorCache;
          if (!newSchema.equalTo(oldSchema)) {
            log.info('schema was changed');
            this._schemaCache = newSchema;
            if (oldSchema) {
              await oldSchema.teardown();
            }
          }
        } else {
          this._schemaCache = newSchema;
        }
      } else {
        // somebody else has updated the cache in the time since we
        // started running, so just drop the schemas we computed
        // during indexing
        await newSchema.teardown();
      }
    } finally {
      await running.destroy();
    }
    this.emit('update_complete', hints);
    log.debug('end update, forceRefresh=%s', forceRefresh);
  }

});
