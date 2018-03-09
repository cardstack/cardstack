const Operations = require('./operations');
const owningDataSource = new WeakMap();
const { flatten } = require('lodash');
const Client = require('@cardstack/elasticsearch/client');
const log = require('@cardstack/logger')('cardstack/indexers');
const DocumentContext = require('./document-context');

class BranchUpdate {
  constructor(branch, seedSchema, client, emitEvent) {
    this.branch = branch;
    this.seedSchema = seedSchema;
    this.client = client;
    this.updaters = Object.create(null);
    this.emitEvent = emitEvent;
    this.schemaModels = [];
    this._schema = null;
    this.bulkOps = null;
    this._touched = Object.create(null);
  }

  async addIndexer(indexer) {
    if (this._schema) {
      throw new Error("Bug in hub indexing. Something tried to add an indexer after we had already established the schema");
    }
    let updater = await indexer.beginUpdate(this.branch, this._readOtherIndexers.bind(this));
    let dataSource = owningDataSource.get(indexer);
    owningDataSource.set(updater, dataSource);
    let newModels = await updater.schema();
    this.schemaModels.push(newModels);
    this.updaters[dataSource.id] = updater;
    return newModels;
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

  async update(forceRefresh, hints) {
    this.bulkOps = this.client.bulkOps({ forceRefresh });
    await this.client.accomodateSchema(this.branch, await this.schema());
    await this._updateContent(hints);
  }

  async _updateContent(hints) {
    let schema = await this.schema();
    let types = (hints || []).map(hint => hint.type).filter(type => Boolean(type));
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
    return docs.map(doc => doc._source.cardstack_pristine.data);
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
    this.emitEvent('add', { type, id, doc });
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
    this.emitEvent('delete', { type, id });
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
    this.emitEvent('delete_all_without_nonce', { sourceId, nonce });
    log.debug("bulk delete older content for data source %s", sourceId);
  }



  async _prepareSearchDoc(type, id, doc) {
    let schema = await this.schema();
    let context = new DocumentContext(this, schema, type, id, doc);
    return context.searchDoc();
  }

}

exports.BranchUpdate = BranchUpdate;
exports.owningDataSource = owningDataSource;
