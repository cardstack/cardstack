const logger = require('@cardstack/plugin-utils/logger');
const request = require('superagent');
const { apply_patch } = require('jsonpatch');
const { URL } = require('url');
const { drupalToCardstackField, drupalToCardstackDoc } = require('./lib/document');

require('es6-promise').polyfill();

class Indexer {
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


}

class Updater {
  constructor(config, log) {
    let {
      url,
      authToken,
      openAPIPatch,
      dataSource
    } = config;
    this.url = url;
    this.authToken = authToken;
    this.openAPIPatch = openAPIPatch;
    this.dataSource = dataSource;
    this.log = log;
  }

  async _ensureSchema() {
    if (!this._schema) {
      this._schema = await this._loadSchema();
    }
  }

  async schema() {
    await this._ensureSchema();
    return this._schema.models;
  }

  async updateContent(meta, hints, ops) {
    await this._ensureSchema();
    await ops.beginReplaceAll();
    for (let model of this._schema.models) {
      await ops.save(model.type, model.id, model);
    }
    for (let endpoint of Object.values(this._schema.endpoints)) {
      let url = new URL(endpoint, this.url).href;
      while (url) {
        this.log.debug("Hitting %s", url);
        try {
          let response = await this._get(url);
          for (let model of response.body.data) {
            await ops.save(model.type, model.id, drupalToCardstackDoc(model, this._schema.models));
          }
          url = response.body.links.next;
        } catch (err) {
          if (err.status) {
            this.log.error("GET %s returned %s", url, err.status);
          } else {
            this.log.error("Error during GET %s: %s", url, err);
          }
          throw err;
        }
      }
    }
    await ops.finishReplaceAll();
    return {};
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
      if (!definition.properties.type.enum) {
        throw new Error(`definition ${name} has no type constraint`);
      }
      let id = definition.properties.type.enum[0];
      endpoints[id] = endpoint;
      this.log.debug("Discovered %s %s", id, endpoint);
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
          },
          'data-source': {
            data: { type: 'data-sources', id: this.dataSource.id }
          }
        },
        meta: {
          'drupal-name': name
        }
      });
    }

    // rewrite related-types from raw drupal entity names to the
    // actual found content types we created
    for (let field of Object.values(fields)) {
      if (field.relationships && field.relationships['related-types']) {
        field.relationships['related-types'].data = field.relationships['related-types'].data.map(entityName => {
          let type = schemaModels.find(m => m.id === entityName);
          if (type) {
            return { type: 'content-types', id: type.id };
          } else {
            this.log.info("field %s points at unknown type %s", field.id, entityName);
          }
        }).filter(Boolean);
      }
    }

    return {
      endpoints,
      models: schemaModels.concat(Object.values(fields))
    };
  }

  _makeField(propName, propDef, fields) {
    let canonicalName = drupalToCardstackField(propName);
    if (!fields[canonicalName]) {
      fields[canonicalName] = {
        type: 'fields',
        id: canonicalName,
        attributes: {
          'field-type': this._fieldTypeFor(propDef)
        },
        meta: { 'drupal-name': propName }
      };
    }
    return { id: canonicalName, type: 'fields' };
  }


  _makeRelationshipField(propName, propDef, fields) {
    let canonicalName = drupalToCardstackField(propName);
    if (!fields[canonicalName]) {
      let relationshipType, relatedTypes;
      if (propDef.properties.data.type === 'array') {
        relationshipType = '@cardstack/core-types::has-many';
        relatedTypes = propDef.properties.data.items.properties.type.enum;
      } else {
        relationshipType = '@cardstack/core-types::belongs-to';
        relatedTypes = propDef.properties.data.properties.type.enum;
      }
      fields[canonicalName] = {
        type: 'fields',
        id: canonicalName,
        attributes: {
          'field-type': relationshipType
        },
        relationships: {
          'related-types': {
            // this will get rewritten on a second pass, after we have
            // found and created all the content types
            data: relatedTypes
          }
        },
        meta: { 'drupal-name': propName }
      };
    }
    return { id: canonicalName, type: 'fields' };
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
    let baseURL = new URL(openAPI.basePath, this.url).href;
    for (let [name, definition] of Object.entries(openAPI.definitions)) {
      if (/^node:/.test(name) || name === 'media:image' || name === 'file:file' || name === 'user:user') {
        let path = this._findEndpoint(name, openAPI);
        if (path) {
          let endpoint = new URL(path, baseURL).href;
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

        return path;
      }
    }
  }

  async _get(url) {
    let authorization = `Bearer ${this.authToken}`;
    let response = await request.get(url)
        .set('Authorization', authorization)
        .set('Accept', 'application/vnd.api+json');

    // Drupal's JSONAPI module returns a 200 even when there are
    // errors. So we need to check for them here. If there was at
    // least some valid data, we don't consider it a failure
    let errors;
    if (response.body.meta && (errors = response.body.meta.errors) && response.body.data.length === 0) {
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

}

module.exports = Indexer;
