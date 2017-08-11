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
  constructor(config, log) {
    let {
      url,
      authToken,
      nodeType,
      fieldConfig,
      fieldStorageConfig,
      jsonapiExtrasEnabled,
      jsonapiResourceConfig
    } = config;
    this.url = url;
    this.authToken = authToken;
    this.log = log;
    this.nodeType = nodeType || 'node_type--node_type';
    this.fieldConfig = fieldConfig || 'field_config--field_config';
    this.fieldStorageConfig = fieldStorageConfig || 'field_storage_config--field_storage_config';
    if (jsonapiExtrasEnabled) {
      this.jsonapiResourceConfig = jsonapiResourceConfig || 'jsonapi_resource_config--jsonapi_resource_config';
    }
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
    if (!links[this.nodeType]) {
      throw new Error(`Found no ${this.nodeType} link at ${baseURL}`, {
        source: { pointer: `/links/${this.nodeType}` }
      });
    }
    if (!links[this.fieldConfig]) {
      throw new Error(`Found no ${this.fieldConfig} link at ${baseURL}`, {
        source: { pointer: `/links/${this.fieldConfig}`}
      });
    }
    if (!links[this.fieldStorageConfig]) {
      throw new Error(`Found no ${this.fieldStorageConfig} link at ${baseURL}`, {
        source: { pointer: `/links/${this.fieldStorageConfig}` }
      });
    }
    if (this.jsonapiResourceConfig && !links[this.jsonapiResourceConfig]) {
      throw new Error(`Found no ${this.jsonapiResourceConfig} link at ${baseURL}`, {
        source: { pointer: `/links/${this.jsonapiResourceConfig}` }
      });
    }

    let [contentTypes, fields, storageConfigs, resourceConfigs] = await Promise.all([
      this._getCollection(links[this.nodeType]),
      this._getCollection(links[this.fieldConfig]),
      this._getCollection(links[this.fieldStorageConfig]),
      this.jsonapiResourceConfig ? this._getCollection(links[this.jsonapiResourceConfig]) : []
    ]);
    return this._buildSchemaModels(contentTypes, fields, storageConfigs, resourceConfigs);
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

  async _buildSchemaModels(drupalContentTypes, drupalFields, storageConfigs, resourceConfigs) {
    this.log.debug('Found %s content types, %s field configs, %s field storage configs, and %s resource configs',
                   drupalContentTypes.length, drupalFields.length, storageConfigs.length, resourceConfigs.length);

    let types = [];
    let fields = Object.create(null);

    for (let drupalType of drupalContentTypes) {
      let resourceConfig = resourceConfigs.find(r => r.attributes.id === `node--${drupalType.attributes.type}`);

      let type = {
        type: 'content-types',
        id: resourceConfig ? resourceConfig.attributes.resourceType : drupalType.attributes.type,
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
