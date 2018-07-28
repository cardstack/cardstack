const { isEqual } = require('lodash');
const log = require('@cardstack/logger')('cardstack/mock-auth/indexer');

module.exports = class Indexer {

  static create(...args) {
    return new this(...args);
  }

  constructor({ dataSource, provideUserSchema }) {
    if (provideUserSchema === false) {
      this.disabled = true;
    } else {
      if (dataSource.userRewriter){
        log.warn("If you use a custom user-rewriter on the mock-auth data source, you should probably also set params.provideUserSchema=false and provide your own user model");
      }
    }
  }

  async branches() {
    return ['master'];
  }

  async beginUpdate() {
    return new Updater(this.disabled);
  }
};

class Updater {

  constructor(disabled) {
    this.disabled = disabled;
  }

  async schema() {
    if (this.disabled) {
      return [];
    }

    return [
      {
        type: 'content-types',
        id: 'mock-users',
        attributes: {
        },
        relationships: {
          'fields': { data: [
            { type: 'fields', id: 'name' },
            { type: 'fields', id: 'email' },
            { type: 'fields', id: 'avatar-url' },
            { type: 'fields', id: 'email-verified' },
            { type: 'fields', id: 'message' },
          ] }
        }
      },
      {
        type: 'fields',
        id: 'name',
        attributes: {
          'field-type': '@cardstack/core-types::string'
        }
      },
      {
        type: 'fields',
        id: 'email',
        attributes: {
          'field-type': '@cardstack/core-types::string'
        }
      },
      {
        type: 'fields',
        id: 'avatar-url',
        attributes: {
          'field-type': '@cardstack/core-types::string'
        }
      },
      {
        type: 'fields',
        id: 'email-verified',
        attributes: {
          'field-type': '@cardstack/core-types::boolean'
        }
      },
      {
        type: 'fields',
        id: 'message',
        attributes: {
          'field-type': '@cardstack/core-types::object'
        }
      },
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
      await ops.save(model.type, model.id, { data: model });
    }
    await ops.finishReplaceAll();
    return {
      lastSchema: schema
    };
  }
}
