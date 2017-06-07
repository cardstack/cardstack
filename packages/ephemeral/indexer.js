const EphemermalStorage = require('./storage');
const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  indexers: 'hub:indexers'
}, class Indexer {
  static create(params) { return new this(params); }

  constructor({ indexers }) {
    this.storage = EphemermalStorage.create(indexers);
  }

  async branches() {
    return ['master'];
  }

  async beginUpdate(/* branch */) {
    return new Updater(this.storage);
  }
});

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

    for (let entry of this.storage.modelsNewerThan(generation)) {
      if (entry.model) {
        await ops.save(entry.type, entry.id, Object.assign({}, entry.model, { meta: { version: String(entry.generation) } }));
      } else {
        await ops.delete(entry.type, entry.id);
      }
    }
    return {
      generation: this.storage.currentGeneration()
    };
  }
}
