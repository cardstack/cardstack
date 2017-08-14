const logger = require('@cardstack/plugin-utils/logger');
const request = require('superagent');
const { apply_patch } = require('jsonpatch');
const { join: pathJoin } = require('path');

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
      openAPIPatch
    } = config;
    this.url = url;
    this.authToken = authToken;
    this.openAPIPatch = openAPIPatch;
    this.log = log;
  }

  async schema() {
    if (!this._schema) {
      this._schema = await this._loadSchema();
    }
    return this._schema.models;
  }

  async _loadSchema() {
    let response = await this._get(`${this.url}/openapi/jsonapi?_format=json`);
    let openAPI = response.body;
    if (this.openAPIPatch) {
      openAPI = apply_patch(openAPI, this.openAPIPatch);
    }

    let schemaModels = [];
    let fields = Object.create(null);
    let endpoints = Object.create(null);

    for (let { name, definition, endpoint } of this._findResources(openAPI)) {
      let id = definition.properties.type.enum[0];
      this.log.debug("%s %s %s", endpoint, name, id);
      let fieldRefs = [];

      for (let [propName, propDef] of Object.entries(definition.properties.attributes.properties)) {
        fieldRefs.push(this._makeField(propName, propDef, fields));
      }

      for (let [propName, propDef] of Object.entries(definition.properties.relationships.properties)) {
        fieldRefs.push(this._makeRelationshipField(propName, propDef, fields));
      }

      schemaModels.push({
        type: 'content-types',
        id,
        relationships: {
          fields: {
            data: fieldRefs
          }
        }
      });
    }

    return {
      endpoints,
      models: schemaModels.concat(Object.values(fields))
    };
  }

  _makeField(propName, propDef, fields) {
    if (!fields[propName]) {
      fields[propName] = {
        type: 'fields',
        id: propName,
        attributes: {
          'field-type': this._fieldTypeFor(propDef)
        }
      };
    }
    return { id: propName, type: 'fields' };
  }

  _makeRelationshipField(propName, propDef, fields) {
    if (propName === 'type' || propName === 'id') {
      // See https://www.drupal.org/node/2779963
      propName = `_drupal_${propName}`;
    }
    if (!fields[propName]) {
      let relationshipType;
      if (propDef.properties.data.type === 'array') {
        relationshipType = '@cardstack/core-types::has-many';
      } else {
        relationshipType = '@cardstack/core-types::belongs-to';
      }
      fields[propName] = {
        type: 'fields',
        id: propName,
        attributes: {
          'field-type': relationshipType
        }
      };
    }
    return { id: propName, type: 'fields' };
  }

  _fieldTypeFor(fieldDef) {
    switch (fieldDef.type) {
    case 'string':
      return '@cardstack/core-types::string';
    case 'integer':
      return '@cardstack/core-types::integer';
    case 'boolean':
      return '@cardstack/core-types::boolean';
    default:
      return '@cardstack/core-types::any';
    }
  }

  *_findResources(openAPI) {
    for (let [name, definition] of Object.entries(openAPI.definitions)) {
      if (/^node:/.test(name)) {
        let endpoint = this._findEndpoint(name, openAPI);
        if (endpoint) {
          yield { name, definition, endpoint };
        }
      }
    }
  }

  _findEndpoint(definitionName, openAPI) {
    // look for the jsonapi endpoint where you can post a new one of these
    for (let [path, pathDef] of Object.entries(openAPI.paths)) {
      if (!pathDef.post || !pathDef.post.parameters) {
        continue;
      }
      if (pathDef.post.parameters.find(p => p.name === 'body' && p.schema && p.schema['$ref'] === `#/definitions/${definitionName}`)) {
        return pathJoin(openAPI.basePath || "/", path);
      }
    }
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

  async updateContent(meta, hints, ops) {

    return {};
  }


}
