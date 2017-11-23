const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  service: `plugin-services:${require.resolve('./service')}`
}, class Indexer {

  async branches() {
    return ['master'];
  }

  async beginUpdate(/* branch */) {
    let storage = await this.service.storageForDataSource(this.dataSource.id, this.initialModels);
    return new Updater(storage, this.dataSource.id);
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
        relationships: {
          'field-type': {
            data: { type: 'field-types', id: '@cardstack/core-types::belongs-to' }
          },
          'related-types': {
            data: [
              { type: 'content-types', id: 'ephemeral-checkpoints' }
            ]
          }
        }
      },
      {
        type: 'content-types',
        id: 'ephemeral-checkpoints',
        attributes: {
          'is-built-in': true
        },
        relationships: {
          'data-source': { data: { type: 'data-sources', id: this.dataSourceId } }
        }
      },
      { type: 'content-types',
        id: 'ephemeral-restores',
        attributes: {
          'is-built-in': true
        },
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
