/*
  There are three sources of schema information.

  1. Most of it lives within a regular data source, just like your
     other content does.

  2. But we need a tiny bit of schema to find the first data
     source. This is the `seedModels` that are passed into the
     constructor below. Note that only schema types are allowed in
     seedModels (not any of your other content).

  3. Internally, we also always load @cardstack/hub/bootstrap-schema,
     which is enough to wire up some of our own modules for things
     like core field types.
*/

const Schema = require('./schema');
const Searcher = require('@cardstack/elasticsearch/searcher');
const logger = require('heimdalljs-logger');
const bootstrapSchema = require('./bootstrap-schema');
const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  seedModels: 'config:seed-models'
},

class SchemaCache {

  static create({ seedModels }) {
    return new this(seedModels);
  }

  constructor(seedModels=[]) {
    this.seedModels = bootstrapSchema.concat(seedModels);
    this.searcher = new Searcher();
    this.searcher.schemaCache = new BootstrapSchemaCache(this.seedModels);
    this.cache = new Map();
    this.log = logger('schema-cache');

    // TODO move this value into plugins-configs for @cardstack/hub.
    this.controllingBranch = 'master';
  }

  async schemaForBranch(branch) {
    if (!this.cache.has(branch)) {
      // we synchronously place a Promise into the cache. This ensures
      // that a subsequent lookup that arrives while we are still
      // working on this one will join it instead of racing it.
      this.cache.set(branch, this._load(branch));
    }
    let schema = await this.cache.get(branch);
    this.log.debug("returning schema for branch %s %s", branch);
    return schema;
  }

  // The "controlling branch" is special because it's used for
  // configuration that is not scoped to any particular branch.
  //
  // For one example: the set of data sources that we're indexing is
  // not something that can vary by branch, since the set of branches
  // itself is discovered by the indexers.
  //
  // For another example: grants only take effect when they are
  // present on the controlling branch. This makes it easier to reason
  // about who can do what.
  async schemaForControllingBranch() {
    return this.schemaForBranch(this.controllingBranch);
  }

  // Instantiates a Schema, while respecting any seedModels. This
  // method does not alter the schemaCache's own state.
  async schemaFrom(models) {
    let types = Schema.ownTypes();
    return Schema.loadFrom(this.seedModels.concat(models).filter(s => types.includes(s.type)));
  }

  // When Indexers reads a branch, it necessarily reads the schema
  // first. And when Writers make a change to a schema model, they
  // need to derive the new schema to make sure it's safe. In either
  // case, the new schema is already available, so this method allows
  // us to push it into the cache.
  notifyBranchUpdate(branch, schema) {
    if (!(schema instanceof Schema)) {
      throw new Error("Bug: notifyBranchUpdate got a non-schema");
    }
    this.log.debug("full schema update on branch %s", branch);
    this.cache.set(branch, Promise.resolve(schema));
  }

  async indexBaseContent(ops) {
    for (let model of this.seedModels) {
      await ops.save(model.type, model.id, model);
    }
  }

  async _load(branch) {
    this.log.debug("initiating schema load on branch %s", branch);
    try {
      let { models, page } = await this.searcher.search(branch, {
        filter: {
          type: Schema.ownTypes()
        },
        page: { size: 1000 }
      });
      if (page.cursor) {
        throw new Error("query for schema models had insufficient page size");
      }
      this.log.debug("completed schema model loading on branch %s, found %s models", branch, models.length);
      let schema = this.schemaFrom(models);
      this.log.debug("instantiated schema for branch %s", branch);
      return schema;
    } catch (err) {
      if (err.status === 404 && err.title === 'No such branch') {
        // our searcher can fail if no index exists yet. But that's OK
        // -- in that case our schema is just our seed models.
        this.log.debug("no search index exists for branch %s, using seeds only", branch);
        return this.schemaFrom([]);
      } else {
        throw err;
      }
    }
  }
});

class BootstrapSchemaCache {
  constructor(seedModels) {
    this.seedModels = seedModels;
    this.schema = null;
  }
  async schemaForBranch() {
    if (!this.schema) {
      let types = Schema.ownTypes();
      this.schema = await Schema.loadFrom(this.seedModels.filter(s => types.includes(s.type)));
    }
    return this.schema;
  }
}
