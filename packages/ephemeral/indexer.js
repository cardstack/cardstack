const EphermalStorage = require('./storage');

module.exports = class Indexer {
  constructor({ storageKey }) {
    this.storage = EphermalStorage.create(storageKey);
  }

  async branches() {
    return ['master'];
  }

  async beginUpdate(/* branch */) {
    return new Updater(this.storage);
  }
};

class Updater {
  constructor(storage) {
    this.storage = storage;
    this.name = 'ephemeral';
  }

  async schema() {
    return this.storage.schemaModels();
  }

  async updateContent(meta, hints, ops) {
    let generation;
    if (meta) {
      generation = meta.generation;
    }
    for (let entry of this.storage.contentModelsNewerThan(generation)) {
      if (entry.model) {
        await ops.save(entry.type, entry.id, entry.model);
      } else {
        await ops.delete(entry.type, entry.id);
      }
    }
    return {
      generation: this.storage.currentGeneration()
    };
  }
}
