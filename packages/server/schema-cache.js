const Schema = require('./schema');
const Searcher = require('@cardstack/elasticsearch/searcher');

class BootstrapSchemaCache {
  constructor() {
    this.schema = null;
  }
  async schemaForBranch() {
    if (!this.schema) {
      this.schema = await Schema.bootstrap();
    }
    return this.schema;
  }
}

module.exports = class SchemaCache {
  constructor() {
    this.searcher = new Searcher(new BootstrapSchemaCache());
    this.cache = new Map();
  }
  async schemaForBranch(branch) {
    if (!this.cache.has(branch)) {
      // we synchronously place a Promise into the cache. This ensures
      // that a subsequent lookup that arrives while we are still
      // working on this one will simple join it.
      this.cache.set(branch, this._load(branch));
    }
    let schema = await this.cache.get(branch);
    return schema;
  }
  async _load(branch) {
    let { models } = await this.searcher.search(branch, {
      filter: {
        type: Schema.ownTypes()
      }
    });
    let schema = await Schema.loadFrom(models);
    return schema;
  }
};
