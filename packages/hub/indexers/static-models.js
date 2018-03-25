/*
  This indexers is responsible for reflecting all our initial static
  models (which includes the bootstrap schema plus the user's
  hard-coded data-sources) in the search index.
*/

const { declareInjections } = require('@cardstack/di');
const { isEqual } = require('lodash');
const bootstrapSchema = require('../bootstrap-schema');

module.exports = declareInjections({
  dataSources: 'config:data-sources',
  schemaLoader: 'hub:schema-loader'
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

  async branches() {
    return ['master'];
  }
  async beginUpdate(/* branch */) {
    return new Updater(this.models, this.schemaModels);
  }
});

class Updater {
  constructor(models, schemaModels) {
    this.models = models;
    this.schemaModels = schemaModels;
  }

  async schema() {
    return this.schemaModels;
  }

  async updateContent(meta, hints, ops) {
    let { models } = this;
    if (meta && isEqual(meta.models, models)) {
      return { models };
    }
    await ops.beginReplaceAll();
    for (let model of models) {
      await ops.save(model.type, model.id, model);
    }
    await ops.finishReplaceAll();
    return { models };
  }

  async read(type, id /*, isSchema */) {
    return this.models.find(m => m.type === type && m.id === id);
  }
}
