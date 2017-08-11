const logger = require('@cardstack/plugin-utils/logger');
const request = require('superagent');
const Error = require('@cardstack/plugin-utils/error');
require('es6-promise').polyfill();

module.exports = class Indexer {
  static create(params) { return new this(params); }

  constructor(config) {
    this.config = config;
    this.log = logger('drupal');
  }

  async branches() {
    return ['master'];
  }

  async beginUpdate(/* branch */) {
    return new Updater(this.config, this.log);
  }
};

class Updater {
  constructor({ url, authToken}, log) {
    this.url = url;
    this.authToken = authToken;
    this.log = log;
  }

  async schema() {
    if (!this._schema) {
      this._schema = await this._loadSchema();
    }
    return this._schema;
  }

  async _loadSchema() {
    let baseURL = this.url + '/api';
    let response = await this._get(baseURL);
    let links = response.body.links;
    if (!links.contentTypes) {
      throw new Error(`Found no contentTypes link at ${baseURL}`, {
        source: { pointer: '/links/contentTypes' }
      });
    }
    if (!links.fields) {
      throw new Error(`Found no fields link at ${baseURL}`, {
        source: { pointer: '/links/fields' }
      });
    }
    if (!links.fieldStorageConfigs) {
      throw new Error(`Found no fieldsStorageConfigs link at ${baseURL}`, {
        source: { pointer: '/links/fieldStorageConfigs' }
      });
    }
    let [contentTypes, fields, storageConfigs] = await Promise.all([
      this._getCollection(links.contentTypes),
      this._getCollection(links.fields),
      this._getCollection(links.fieldStorageConfigs)
    ]);
    return this._buildSchemaModels(contentTypes, fields, storageConfigs);
  }

  async _getCollection(url) {
    let records = [];
    while (url) {
      let response = await this._get(url);
      records = records.concat(response.body.data);
      url = response.body.links.next;
    }
    return records;
  }

  async _get(url) {
    let authorization = `Bearer ${this.authToken}`;
    let response = await request.get(url).set('Authorization', authorization);

    // Drupal's JSONAPI module returns a 200 even when there are
    // errors. So we need to check for them here.
    let errors;
    if (response.body.meta && (errors = response.body.meta.errors)) {
      if (errors.length > 1) {
        let err = errors[0];
        err.additionalErrors = errors.slice(1);
        throw err;
      }
      if (errors.length === 1) {
        throw errors[0];
      }
    }

    return response;
  }

  async _buildSchemaModels(drupalContentTypes, drupalFields, storageConfigs) {
    this.log.debug('Found %s content types, %s field configs, and %s field storage configs', drupalContentTypes.length, drupalFields.length, storageConfigs.length);

    let types = [];
    let fields = Object.create(null);

    for (let drupalType of drupalContentTypes) {
      let type = {
        type: 'content-types',
        id: drupalType.attributes.type,
        relationships: {
          fields: {
            data: []
          }
        }
      };
      for (let drupalField of drupalFields) {
        if (drupalField.attributes.bundle === type.id) {
          let field = fields[drupalField.attributes.field_name];
          if (!field) {
            let config = storageConfigs.find(c => c.attributes.field_name === drupalField.attributes.field_name);
            if (!config) {
              throw new Error(`missing storage config for field ${drupalField.attributes.field_name}`);
            }
            field = fields[drupalField.attributes.field_name] = {
              type: 'fields',
              id: drupalField.attributes.field_name,
              attributes: {
                'field-type': '@cardstack/core-types::any'
              },
              meta: {
                'drupal-type': config.attributes.type,
                'drupal-cardinality': config.attributes.cardinality,
                'drupal-settings': config.attributes.settings
              }
            };
          }
          type.relationships.fields.data.push({ type: field.type, id: field.id });
        }
      }
      types.push(type);
    }
    return types.concat(Object.values(fields));
  }

  async updateContent(/* meta, hints, ops */) {
    return {};
  }


}
