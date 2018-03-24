const { declareInjections } = require('@cardstack/di');
const { isEqual } = require('lodash');
const bootstrapSchema = require('../bootstrap-schema');

module.exports = declareInjections({
  dataSources: 'config:data-sources',
  initialModels: 'config:initial-models',
  schemaLoader: 'hub:schema-loader'
},

// This indexer will only auto index initial models that originate
// from ephemeral at boot time. Non ephemeral models need to be manually
// indexed.

class InitialModelsIndexer {
  static create({ dataSources, initialModels, schemaLoader }) {
    let models = bootstrapSchema.concat(initialModels()).concat(dataSources);
    let schemaTypes = schemaLoader.ownTypes();
    let schemaModels = models.filter(m => m && schemaTypes.includes(m.type));

    return new this(models, schemaModels, schemaLoader);
  }

  constructor(models, schemaModels, schemaLoader) {
    this.models = models;
    this.schemaModels = schemaModels;
    this.schemaLoader = schemaLoader;
  }

  async branches() {
    return ['master'];
  }

  async beginUpdate(/* branch */) {
    return new Updater(await this._ephemeralModels(), this.schemaModels);
  }

  async _ephemeralModels() {
    let { models, schemaModels, schemaLoader } = this;

    let schema = await schemaLoader.loadFrom(schemaModels);

    return models.filter(model => {
      if (!model) { return; }
      let type = schema.types.get(model.type);
      if (!type) { return; }
      let source = type.dataSource;
      if (!source) { return; }
      return source.sourceType === '@cardstack/ephemeral';
    });
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
