const { isEqual } = require('lodash');
const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
}, class TestSupportIndexer {

  async branches() {
    return ['master'];
  }

  async beginUpdate() {
    return new Updater(this.dataSource.id);
  }
});

class Updater {
  constructor(dataSourceId) {
    this.name = 'test-support';
    this.dataSourceId = dataSourceId;
  }

  async schema() {
    return [
      {
        type: 'fields',
        id: 'checkpoint-data-source',
        attributes: {
          'field-type': '@cardstack/core-types::belongs-to'
        },
        relationships: {
          'related-types': {
            data: [
              { type: 'content-types', id: 'data-sources' }
            ]
          }
        }
      },
      {
        type: 'fields',
        id: 'checkpoint',
        attributes: {
          'field-type': '@cardstack/core-types::belongs-to'
        },
        relationships: {
          'related-types': {
            data: [
              { type: 'content-types', id: 'checkpoints' }
            ]
          }
        }
      },
      {
        type: 'content-types',
        id: 'checkpoints',
        attributes: {
          'is-built-in': true
        },
        relationships: {
          'data-source': { data: { type: 'data-sources', id: this.dataSourceId } },
          fields: {
            data: [ { type: 'fields', id: 'checkpoint-data-source' } ]
          }
        }
      },
      { type: 'content-types',
        id: 'restores',
        attributes: {
          'is-built-in': true
        },
        relationships: {
          'data-source': { data: { type: 'data-sources', id: this.dataSourceId } },
          fields: {
            data: [ { type: 'fields', id: 'checkpoint' },
                    { type: 'fields', id: 'checkpoint-data-source' },
                    { type: 'fields', id: 'params' } ]
          }
        }
      }
    ];
  }

  async updateContent(meta, hints, ops) {
    let schema = await this.schema();
    if (meta) {
      let { lastSchema } = meta;
      if (isEqual(lastSchema, schema)) {
        return;
      }
    }

    await ops.beginReplaceAll();

    for (let model of schema) {
      await ops.save(model.type, model.id, model);
    }

    await ops.finishReplaceAll();

    return {
      lastSchema: schema
    };
  }

  async read(type, id, isSchema) {
    if (isSchema) {
      return (await this.schema()).find(model => model.type === type && model.id === model.id);
    }
  }
}
