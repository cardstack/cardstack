/*
  This indexers is responsible for reflecting all our initial static
  models (which includes the bootstrap schema plus the user's
  hard-coded data-sources) in the search index.
*/

const { declareInjections } = require('@cardstack/di');
const { isEqual } = require('lodash');
const bootstrapSchema = require('../bootstrap-schema');

module.exports = declareInjections(
  {
    dataSources: 'config:data-sources',
    schemaLoader: 'hub:schema-loader',
  },

  class StaticModelsIndexer {
    static create({ dataSources, schemaLoader }) {
      let models = bootstrapSchema.concat(dataSources);
      let schemaTypes = schemaLoader.ownTypes();
      let schemaModels = models.filter(m => schemaTypes.includes(m.type));
      return new this(models, schemaModels);
    }

    constructor(models, schemaModels) {
      this.models = models;
      this.schemaModels = schemaModels;
    }

    async beginUpdate() {
      return new Updater(this.models, this.schemaModels);
    }
  }
);

class Updater {
  constructor(models, schemaModels) {
    this.models = models;
    this.schemaModels = schemaModels;

    // because we are special and built into the hub, this gets set
    // magically for us after the schema() hook but before the
    // updateContent() hook. We cannot return the static schema models
    // ourselves from our schema() hook because the full set of schema
    // models isn't known until the complete crawl of all data sources
    // (including ours) has happened.
    this.staticModels = null;
  }

  async schema() {
    return this.schemaModels;
  }

  async updateContent(meta, hints, ops) {
    let models = this.models.concat(this.staticModels);
    if (meta && isEqual(meta.models, models)) {
      return { models };
    }
    await ops.beginReplaceAll();
    for (let model of models) {
      await ops.save(model.type, model.id, { data: model });
    }
    await ops.finishReplaceAll();
    return { models };
  }
}
