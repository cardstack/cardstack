const { declareInjections } = require('@cardstack/di');
const { isEqual } = require('lodash');
const bootstrapSchema = require('../bootstrap-schema');

module.exports = declareInjections({
  seedModels: 'config:seed-models',
  schemaLoader: 'hub:schema-loader'
},

class SeedsIndexer {
  static create({ seedModels, schemaLoader }) {
    let models = bootstrapSchema.concat(seedModels);
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
