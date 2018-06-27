const Operations = require('./operations');
const owningDataSource = new WeakMap();
const { flatten } = require('lodash');
const Client = require('@cardstack/elasticsearch/client');
const log = require('@cardstack/logger')('cardstack/indexers');
const DocumentContext = require('./document-context');
const Session = require('@cardstack/plugin-utils/session');

const FINALIZED = {};

class BranchUpdate {
  constructor(branch, seedSchema, client, emitEvent, isControllingBranch) {
    this.branch = branch;
    this.seedSchema = seedSchema;
    this.client = client;
    this.updaters = Object.create(null);
    this.emitEvent = emitEvent;
    this.isControllingBranch = isControllingBranch;
    this.schemaModels = [];
    this._schema = null;
    this.bulkOps = null;
    this._touched = Object.create(null);
    this.read = this.read.bind(this);
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
    this.bulkOps = this.client.bulkOps({ forceRefresh });
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
      let newMeta = await updater.updateContent(meta, hints, publicOps, this.read);
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
    let touched = Object.keys(this._touched);
    let accumulatedDocs = [];

    for (let i = 0; i * size < touched.length; i++) {
      let touchedBatch = touched.slice(i * size, (i + 1) * size);
      let esBody = {
        query: {
          bool: {
            must: [
              { terms: { cardstack_references : touchedBatch } }
            ],
          }
        },
        size
      };

      let result = await this.client.es.search({
        index: Client.branchToIndexName(this.branch),
        body: esBody
      });

      let docs = result.hits.hits.map(hit => {
        let { id, type } = hit._source.cardstack_pristine.data;
        return { id, type };
      });
      accumulatedDocs = accumulatedDocs.concat(docs);
    }
    return accumulatedDocs;
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
          if (type === 'user-realms') {
            // if we have an invalidated user-realms and it hasn't
            // already been touched, that's because the corresponding
            // user was delete, so we should also delete the
            // user-realms.
            await this.delete(type, id);
          } else {
            let resource = await this.read(type, id);
            if (resource) {
              let sourceId = schema.types.get(type).dataSource.id;
              let nonce = 0;
              await this.add(type, id, resource, sourceId, nonce);
            }
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
    let model = await updater.read(type, id, isSchemaType, this.read);
    if (!model) {
      // TODO: this is a complexity that can go away after we refactor
      // so that a content type can live in multiple data
      // sources. Right now it's needed because our bootstrap schema
      // and hard-coded data sources can provide models of types that
      // are otherwise also stored elsewhere.
      let staticUpdater = this.updaters['static-models'];
      if (staticUpdater) {
        model = await staticUpdater.read(type, id, isSchemaType, this.read);
      }
    }
    return model;
  }

  async add(type, id, doc, sourceId, nonce) {
    this._touched[`${type}/${id}`] = true;
    let schema = await this.schema();
    let context = new DocumentContext({
      schema,
      type,
      id,
      sourceId,
      generation: nonce,
      upstreamDoc: doc,
      branch: this.branch,
      read: (type, id) => this.read(type, id),
      searchDocFieldMapping: (fieldName) => this.client.logicalFieldToES(this.branch, fieldName) // remove this after we replace ES
    });

    let searchDoc = await context.searchDoc();
    if (!searchDoc) {
      // bad documents get ignored. The DocumentContext logs these for
      // us, so all we need to do here is nothing.
      return;
    }
    searchDoc.cardstack_pristine = await context.pristineDoc();
    searchDoc.cardstack_references = await context.references();
    searchDoc.cardstack_realms = await context.realms();
    searchDoc.cardstack_source = context.sourceId;

    if (context.generation) {
      searchDoc.cardstack_generation = context.generation;
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
    if (this.isControllingBranch) {
      await this._maybeUpdateRealms(type, id, doc, sourceId, nonce);
    }
  }

  async _maybeUpdateRealms(type, id, doc, sourceId, nonce) {
    let schema = await this.schema();
    let realms = await schema.userRealms(doc);
    if (realms) {
      let userRealmsId = Session.encodeBaseRealm(type, id);
      await this.add('user-realms', userRealmsId, {
        type: 'user-realms',
        id: userRealmsId,
        attributes: {
          realms
        },
        relationships: {
          user: {
            data: { type, id }
          }
        }
      }, sourceId, nonce);
    }
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
}

exports.BranchUpdate = BranchUpdate;
