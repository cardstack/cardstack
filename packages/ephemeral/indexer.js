const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  service: `plugin-services:${require.resolve('./service')}`,
  loadInitialModels: 'config:initial-models'
}, class Indexer {

  async branches() {
    return ['master'];
  }

  async beginUpdate(/* branch */) {
    if (this.initialModels) {
      throw new Error("The ephemeral data source no longer accepts params.initialModels. Use the new general-purpose seed model support instead.");
    }
    let initialModels = this.initialModels || [];
    if (typeof this.loadInitialModels === 'function') {
      initialModels = initialModels.concat(await this.loadInitialModels());
    }
    let storage = await this.service.findOrCreateStorage(this.dataSource.id, initialModels);
    return new Updater(storage, this.dataSource.id);
  }
});

class Updater {
  constructor(storage, dataSourceId) {
    this.storage = storage;
    this.name = 'ephemeral';
    this.dataSourceId = dataSourceId;
  }

  async schema() {
    return this.storage.schemaModels();
  }

  async updateContent(meta, hints, ops) {
    let generation, identity;
    if (meta) {
      generation = meta.generation;
      identity = meta.identity;
    }
    let newGeneration = this.storage.currentGeneration();

    if (identity !== this.storage.identity) {
      generation = null;
      await ops.beginReplaceAll();
    }

    for (let entry of this.storage.modelsNewerThan(generation)) {
      if (entry.model) {
        await ops.save(entry.type, entry.id, Object.assign({}, entry.model, { meta: { version: String(entry.generation) } }));
      } else {
        await ops.delete(entry.type, entry.id);
      }
    }

    if (identity !== this.storage.identity) {
      await ops.finishReplaceAll();
    }

    return {
      generation: newGeneration,
      identity: this.storage.identity
    };
  }

  async read(type, id /*, isSchema */) {
    return this.storage.lookup(type, id);
  }
}
