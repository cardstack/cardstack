const Error = require('@cardstack/data-source/error');
const Field = require('@cardstack/server/field');
const Constraint = require('@cardstack/server/constraint');
const ContentType = require('@cardstack/server/content-type');
const DataSource = require('@cardstack/server/data-source');
const Grant = require('@cardstack/server/grant');
const Plugins = require('@cardstack/server/plugins');
const bootstrapSchema = require('./bootstrap-schema');
const logger = require('heimdalljs-logger');

module.exports = class Schema {

  static async bootstrap() {
    // Our schema itself has a schema. This meta-schema isn't editable.
    return this.loadFrom(bootstrapSchema);
  }

  static ownTypes() {
    return ['content-types', 'fields', 'constraints', 'data-sources', 'grants', 'plugin-configs'];
  }

  static async loadFrom(models) {
    let plugins = await Plugins.load(models.filter(model => model.type === 'plugin-configs'));

    let authLog = logger('auth');

    let constraints = new Map();
    for (let model of models) {
      if (!this.ownTypes().includes(model.type)) {
        throw new Error(`attempted to load schema including non-schema type "${model.type}"`);
      }
      if (model.type === 'constraints') {
        constraints.set(model.id, new Constraint(model, plugins));
      }
    }

    let grants = models
        .filter(model => model.type === 'grants')
        .map(model => new Grant(model));

    let fields = new Map();
    for (let model of models) {
      if (model.type === 'fields') {
        fields.set(model.id, new Field(model, plugins, constraints, grants, authLog));
      }
    }

    let dataSources = new Map();
    for (let model of models) {
      if (model.type === 'data-sources') {
        dataSources.set(model.id, new DataSource(model, plugins));
      }
    }

    let types = new Map();
    for (let model of models) {
      if (model.type === 'content-types') {
        types.set(model.id, new ContentType(model, fields, dataSources, grants));
      }
    }

    return new this(types, fields);
  }

  constructor(types, fields) {
    this.types = types;
    this.fields = fields;
    this._mapping = null;
  }

  async validationErrors(pendingChange, context={}) {
    try {
      await this.validate(pendingChange, context);
      return [];
    } catch (err) {
      if (!err.isCardstackError) { throw err; }
      if (err.additionalErrors) {
        return [err].concat(err.additionalErrors);
      } else {
        return [err];
      }
    }
  }

  async validate(pendingChange, context={}) {
    let type;
    if (pendingChange.finalDocument) {
      // Create or update: check basic request document structure.
      this._validateDocumentStructure(pendingChange.finalDocument, context);
      type = pendingChange.finalDocument.type;
    } else {
      // Deletion. There's no request document to check.
      type = pendingChange.originalDocument.type;
    }

    let contentType = this.types.get(type);
    if (!contentType) {
      throw new Error(`"${type}" is not a valid type`, {
        status: 400,
        source: { pointer: '/data/type' }
      });
    }
    await contentType.validate(pendingChange, context);
  }

  _validateDocumentStructure(document, context) {
    if (!document.type) {
      throw new Error(`missing required field "type"`, {
        status: 400,
        source: { pointer: '/data/type' }
      });
    }

    if (context.type != null) {
      if (document.type !== context.type) {
        throw new Error(`the type "${document.type}" is not allowed here`, {
          status: 409,
          source: { pointer: '/data/type' }
        });
      }
    }

    if (context.id != null) {
      if (!document.id) {
        throw new Error('missing required field "id"', {
          status: 400,
          source: { pointer: '/data/id' }
        });
      }
      if (String(document.id) !== context.id) {
        throw new Error('not allowed to change "id"', {
          status: 403,
          source: { pointer: '/data/id' }
        });
      }
    }
  }

  mapping() {
    if (!this._mapping) {
      this._mapping = {};
      for (let contentType of this.types.values()) {
        this._mapping[contentType.id] = contentType.mapping();
      }
    }
    return this._mapping;
  }

};
