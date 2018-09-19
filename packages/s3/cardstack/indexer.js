const { isEqual }   = require('lodash');

module.exports = class Indexer {

  static create(...args) {
    return new this(...args);
  }

  constructor({ config }) {
    this.config = config;
  }

  async branches() {
    return ['master'];
  }

  async beginUpdate() {
    return new Updater({config: this.config});
  }
};

class Updater {

  constructor({ config }) {
    this.config = config;
  }

  // TODO: static models
  async schema() {
    let contentType = {
      type: 'content-types',
      id: 'files',
      attributes: {
      },
      relationships: {
        fields: { data: [] },
        'data-source': {
          data: {type: 'data-sources', id: 's3'}
        }
      }
    };

    let schema = [contentType];

    let addField = (fieldName, type="@cardstack/core-types::string", relationships={}) => {
      let field = {
        type: 'fields',
        id: fieldName,
        attributes: {
          'field-type': type
        },
        relationships
      };
      schema.push(field);
      contentType.relationships.fields.data.push({type: 'fields', id: fieldName});
    };

    addField('created-at', "@cardstack/core-types::date");
    addField('size', "@cardstack/core-types::integer");
    addField('content-type', "@cardstack/core-types::string");
    addField('sha-sum', "@cardstack/core-types::string");
    addField('file-name', "@cardstack/core-types::string");

    return schema;
  }

  async updateContent(meta, hints, ops) {
    if (hints) {
      // TODO: Actualy index all S3 files here
    } else {
      return await this.updateSchema(meta, ops);
    }

  }

  async updateSchema(meta, ops) {
    let schema = await this.schema();

    if (meta) {
      let { lastSchema } = meta;
      if (isEqual(lastSchema, schema)) {
        return;
      }
    }
    for (let model of schema) {
      await ops.save(model.type, model.id, {data: model});
    }
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
