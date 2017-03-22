const Error = require('@cardstack/plugin-utils/error');
const Field = require('@cardstack/server/field');
const Constraint = require('@cardstack/server/constraint');
const ContentType = require('@cardstack/server/content-type');
const DataSource = require('@cardstack/server/data-source');
const Grant = require('@cardstack/server/grant');
const Plugins = require('@cardstack/server/plugins');
const logger = require('heimdalljs-logger');
const bootstrapSchema = require('./bootstrap-schema');

const ownTypes = Object.freeze(['content-types', 'fields', 'constraints', 'data-sources', 'grants', 'plugin-configs', 'default-values']);

module.exports = class Schema {
  static ownTypes() {
    return ownTypes;
  }

  static async loadFrom(inputModels) {
    let models = bootstrapSchema.concat(inputModels);

    let plugins = await Plugins.load(models.filter(model => model.type === 'plugin-configs'));

    let authLog = logger('auth');
    let schemaLog = logger('schema');

    let constraints = new Map();
    for (let model of models) {
      if (!ownTypes.includes(model.type)) {
        throw new Error(`attempted to load schema including non-schema type "${model.type}"`);
      }
      if (model.type === 'constraints') {
        constraints.set(model.id, new Constraint(model, plugins));
      }
    }

    let defaultValues = new Map();
    for (let model of models) {
      if (model.type === 'default-values') {
        defaultValues.set(model.id, model.attributes);
      }
    }

    let grants = models
        .filter(model => model.type === 'grants')
        .map(model => new Grant(model));

    let fields = new Map();
    for (let model of models) {
      if (model.type === 'fields') {
        fields.set(model.id, new Field(model, plugins, constraints, grants, defaultValues, authLog));
      }
    }

    let dataSources = new Map();
    for (let model of models) {
      if (model.type === 'data-sources') {
        dataSources.set(model.id, new DataSource(model, plugins));
      }
    }

    let defaultDataSource;
    let serverConfig = plugins.configFor('@cardstack/server');
    if (serverConfig && serverConfig['default-data-source']) {
      defaultDataSource = serverConfig['default-data-source'];
    }

    schemaLog.debug('default data source %j', defaultDataSource);


    let types = new Map();
    for (let model of models) {
      if (model.type === 'content-types') {
        types.set(model.id, new ContentType(model, fields, dataSources, defaultDataSource, grants));
      }
    }

    return new this(types, fields, inputModels);
  }

  constructor(types, fields, originalModels) {
    this.types = types;
    this.fields = fields;
    this._mapping = null;
    this._originalModels = originalModels;
  }

  // derives a new schema by adding, updating, or removing one model.
  applyChange(type, id, model) {
    if (!ownTypes.includes(type)) {
      // not a schema model, so we are unchanged.
      return this;
    }
    let models = this._originalModels.filter(m => m.type !== type || m.id !== id);
    if (model) {
      models.push(model);
    }
    return this.constructor.loadFrom(models);
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
