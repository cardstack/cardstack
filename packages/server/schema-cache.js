/*
  There are three sources of schema information.

  1. Most of it lives within a regular data source, just like your
     other content does.

  2. But we need a tiny bit of schema to find the first data
     source. This is the `seedModels` that are passed into the
     constructor below. Note that only schema types are allowed in
     seedModels (not any of your other content).

  3. Internally, we also always load @cardstack/server/bootstrap-schema,
     which is enough to wire up some of our own modules for things
     like core field types.
*/

const Schema = require('./schema');
const Searcher = require('@cardstack/elasticsearch/searcher');
const logger = require('heimdalljs-logger');

module.exports = class SchemaCache {
  constructor(seedModels=[]) {
    this.seedModels = seedModels;
    this.searcher = new Searcher(new BootstrapSchemaCache(seedModels));
    this.cache = new Map();
    this.log = logger('schema-cache');
  }
  async schemaForBranch(branch) {
    if (!this.cache.has(branch)) {
      // we synchronously place a Promise into the cache. This ensures
      // that a subsequent lookup that arrives while we are still
      // working on this one will join it instead of racing it.
      this.cache.set(branch, this._load(branch));
    }
    let schema = await this.cache.get(branch);
    this.log.debug("returning schema for branch %s", branch);
    return schema;
  }
  async _load(branch) {
    this.log.debug("initiating schema load on branch %s", branch);
    let { models, page } = await this.searcher.search(branch, {
      filter: {
        type: Schema.ownTypes()
      },
      page: { size: 100 }
    });
    if (page.cursor) {
      throw new Error("query for schema models had insufficient page size");
    }
    return this.schemaFrom(models);
  }

  async schemaFrom(models) {
    return Schema.loadFrom(this.seedModels.concat(models));
  }

  // When an indexer loads a branch, it necessarily reads the schema
  // first. It then uses this method to update the our cache.
  notifyBranchUpdate(branch, schema) {
    this.log.debug("full schema update on branch %s", branch);
    this.cache.set(branch, Promise.resolve(schema));
  }

  // when a writer touches a model, it notifies us because there's a
  // chance the model was part of a schema.
  async notifyUpdated(branch, type, id, document) {
    if (this.cache.has(branch)) {
      let schema = await this.cache.get(branch);
      let newSchema = schema.applyChange(type, id, document);
      if (newSchema !== schema) {
        this.cache.set(branch, Promise.resolve(newSchema));
      }
    }
  }
};

class BootstrapSchemaCache {
  constructor(seedModels) {
    this.seedModels = seedModels;
    this.schema = null;
  }
  async schemaForBranch() {
    if (!this.schema) {
      this.schema = await Schema.loadFrom(this.seedModels);
    }
    return this.schema;
  }
}
