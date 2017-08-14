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

const Searcher = require('@cardstack/elasticsearch/searcher');
const logger = require('@cardstack/plugin-utils/logger');
const bootstrapSchema = require('./bootstrap-schema');
const { declareInjections } = require('@cardstack/di');
const Schema = require('./schema');

module.exports = declareInjections({
  seedModels: 'config:seed-models',
  schemaLoader: 'hub:schema-loader'
},

class SchemaCache {

  static create(opts) {
    return new this(opts);
  }

  constructor({ seedModels, schemaLoader }) {
    this.seedModels = bootstrapSchema.concat(seedModels || []);
    this.searcher = new Searcher();
    this.searcher.schemaCache = new BootstrapSchemaCache(this.seedModels, this);
    this.cache = new Map();
    this.log = logger('schema-cache');
    this.schemaLoader = schemaLoader;

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
    this.log.debug("returning schema for branch %s", branch);
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
    let types = this.schemaLoader.ownTypes();
    return this.schemaLoader.loadFrom(this.seedModels.concat(models).filter(s => types.includes(s.type)));
  }


  prepareBranchUpdate(branch) {
    return { key: this.cache.get(branch) };
  }

  // When Indexers reads a branch, it necessarily reads the schema
  // first. And when Writers make a change to a schema model, they
  // need to derive the new schema to make sure it's safe. In either
  // case, the new schema is already available, so this method allows
  // us to push it into the cache.
  //
  // We require a branchUpdateToken that was returned from
  // prepareBranchUpdate. You should call prepareBrancUpdate *before*
  // starting to compute the new schema. This helps us maintain causal
  // order within the schema cache.
  notifyBranchUpdate(branch, schema, branchUpdateToken) {
    if (!(schema instanceof Schema)) {
      throw new Error("Bug: notifyBranchUpdate got a non-schema");
    }
    if (this.cache.get(branch) === branchUpdateToken.key) {
      this.log.debug("full schema update on branch %s", branch);
      this.cache.set(branch, Promise.resolve(schema));
    } else {
      this.log.debug("branch update token is stale, ignoring");
    }
  }

  async indexBaseContent(ops) {
    await ops.beginReplaceAll();
    for (let model of this.seedModels) {
      await ops.save(model.type, model.id, model);
    }
    await ops.finishReplaceAll();
  }

  async _load(branch) {
    this.log.debug("initiating schema load on branch %s", branch);
    try {
      let { models, page } = await this.searcher.search(branch, {
        filter: {
          type: this.schemaLoader.ownTypes()
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
  constructor(seedModels, schemaCache) {
    this.seedModels = seedModels;
    this.schema = null;
    this.schemaCache = schemaCache;
  }
  async schemaForBranch() {
    if (!this.schema) {
      this.schema = await this.schemaCache.schemaFrom([]);
    }
    return this.schema;
  }
}
