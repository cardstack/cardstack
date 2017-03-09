/*
  This is a placeholder for an actual cache, with the appropriate
  external API. It doesn't actually cache right now.
*/

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
  }
  async schemaForBranch(branch) {
    let { models } = await this.searcher.search(branch, {
      filter: {
        type: Schema.ownTypes()
      }
    });
    return Schema.loadFrom(models);
  }
};
