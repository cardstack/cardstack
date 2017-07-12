const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  service: `plugin-services:${require.resolve('./service')}`
}, class Indexer {

  async branches() {
    return ['master'];
  }

  async beginUpdate(/* branch */) {
    return new Updater(this.service.storageForDataSource(this.dataSourceId, this.initialModels), this.dataSourceId);
  }
});

class Updater {
  constructor(storage, dataSourceId) {
    this.storage = storage;
    this.name = 'ephemeral';
    this.dataSourceId = dataSourceId;
  }

  _ownSchema() {
    return [
      {
        type: 'fields',
        id: 'checkpoint',
        attributes: {
          'field-type': '@cardstack/core-types::belongs-to'
        }
      },
      {
        type: 'content-types',
        id: 'ephemeral-checkpoints',
        relationships: {
          'data-source': { data: { type: 'data-sources', id: this.dataSourceId } }
        }
      },
      { type: 'content-types',
        id: 'ephemeral-restores',
        relationships: {
          'data-source': { data: { type: 'data-sources', id: this.dataSourceId } },
          fields: {
            data: [ { type: 'fields', id: 'checkpoint' } ]
          }
        }
      }
    ];
  }

  async schema() {
    return this.storage.schemaModels().concat(this._ownSchema());
  }

  async updateContent(meta, hints, ops) {
    let generation;
    if (meta) {
      generation = meta.generation;
    }
    let newGeneration = this.storage.currentGeneration();

    for (let model of this._ownSchema()) {
      await ops.save(model.type, model.id, model);
    }

    for (let entry of this.storage.modelsNewerThan(generation)) {
      if (entry.model) {
        await ops.save(entry.type, entry.id, Object.assign({}, entry.model, { meta: { version: String(entry.generation) } }));
      } else {
        await ops.delete(entry.type, entry.id);
      }
    }
    return {
      generation: newGeneration
    };
  }
}
