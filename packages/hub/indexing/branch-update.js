const Operations = require('./operations');
const owningDataSource = new WeakMap();
const { flatten } = require('lodash');
const log = require('@cardstack/logger')('cardstack/indexers');

const FINALIZED = {};

class BranchUpdate {
  constructor(branch, seedSchema, client, emitEvent, isControllingBranch, owner) {
    this.branch = branch;
    this.seedSchema = seedSchema;
    this.client = client;
    this.updaters = Object.create(null);
    this.emitEvent = emitEvent;
    this.isControllingBranch = isControllingBranch;
    this.searchers = owner.lookup('hub:searchers');
    this.currentSchema = owner.lookup('hub:current-schema');
    this.schemaModels = [];
    this._schema = null;
    this._batch = client.beginBatch(this.currentSchema, this.searchers);
  }

  async addDataSource(dataSource) {
    if (this._schema) {
      throw new Error("Bug in hub indexing. Something tried to add an indexer after we had already established the schema");
    }
    let indexer = dataSource.indexer;
    if (!indexer) {
      return [];
    }
    let updater = this.updaters[dataSource.id] = await indexer.beginUpdate(this.branch);
    owningDataSource.set(updater, dataSource);
    let newModels = await updater.schema();
    this.schemaModels.push(newModels);
    return newModels;
  }

  addStaticModels(schemaModels, allModels) {
    this.schemaModels = this.schemaModels.concat(schemaModels);
    this.updaters['static-models'].staticModels = allModels;
  }

  async schema() {
    if (this._schema === FINALIZED) {
      throw new Error("Bug: the schema has already been taken away from this branch update");
    }
    if (!this._schema) {
      this._schema = await this.seedSchema.applyChanges(flatten(this.schemaModels).map(model => ({ type: model.type, id: model.id, document: model })));
    }
    return this._schema;
  }

  async takeSchema() {
    let schema = await this.schema();
    // We are giving away ownership, so we don't retain our reference
    // and we don't tear it down when we are destroyed
    this._schema = FINALIZED;
    return schema;
  }

  async destroy() {
    if (this._schema && this._schema !== FINALIZED) {
      await this._schema.teardown();
    }
    for (let updater of Object.values(this.updaters)) {
      if (typeof updater.destroy === 'function') {
        await updater.destroy();
      }
    }
  }

  async update(forceRefresh, hints) {
    await this.client.accomodateSchema(this.branch, await this.schema());
    await this._updateContent(hints);
  }

  async _updateContent(hints) {
    let schema = await this.schema();
    let types = hints && Array.isArray(hints) ? hints.map(hint => hint.type).filter(type => Boolean(type)) : [];
    let updaters = Object.entries(this.updaters);

    let dataSourceIds = types.map(type => {
      let contentType = schema.types.get(type);
      if (!contentType) { return; }
      let dataSource = contentType.dataSource;
      if (!dataSource) { return; }
      return dataSource.id;
    }).filter(item => Boolean(item));

    if (dataSourceIds.length) {
      updaters = updaters.filter(([ sourceId ]) => dataSourceIds.includes(sourceId));
    }

    for (let [sourceId, updater] of updaters) {
      let meta = await this._loadMeta(updater);
      let publicOps = Operations.create(this, sourceId);
      let newMeta = await updater.updateContent(meta, hints, publicOps);
      await this._saveMeta(updater, newMeta);
    }

    await this._batch.done();
  }

  async _loadMeta(updater) {
    return this.client.loadMeta({
      branch: this.branch,
      id: owningDataSource.get(updater).id,
    });
  }

  async _saveMeta(updater, newMeta) {
    // the plugin-specific metadata is wrapped inside a "params"
    // property so that we can tell elasticsearch not to index any of
    // it. We don't want inconsistent types across plugins to cause
    // mapping errors.
    return this.client.saveMeta({
        branch: this.branch,
        id: owningDataSource.get(updater).id,
        params: newMeta
    });
  }

  async add(type, id, doc, sourceId, nonce) {
    let schema = await this.schema();
    let context = this.searchers.createDocumentContext({
      schema,
      type,
      id,
      sourceId,
      generation: nonce,
      upstreamDoc: doc,
      branch: this.branch
    });

    let searchDoc = await context.searchDoc();
    if (!searchDoc) {
      // bad documents get ignored. The DocumentContext logs these for
      // us, so all we need to do here is nothing.
      return;
    }

    await this._batch.saveDocument(context);

    this.emitEvent('add', { type, id, doc });
    log.debug("save %s %s", type, id);
  }

  async delete(type, id) {
    let schema = await this.schema();
    let context = this.searchers.createDocumentContext({
      schema,
      type,
      id,
      branch: this.branch
    });

    await this._batch.deleteDocument(context);

    this.emitEvent('delete', { type, id });
    log.debug("delete %s %s", type, id);
  }

  async deleteAllWithoutNonce(sourceId, nonce) {
    await this.client.deleteOlderGenerations(this.branch, sourceId, nonce);
    this.emitEvent('delete_all_without_nonce', { sourceId, nonce });
    log.debug("bulk delete older content for data source %s", sourceId);
  }
}

exports.BranchUpdate = BranchUpdate;
