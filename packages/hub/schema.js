const Error = require('@cardstack/plugin-utils/error');
const Field = require('@cardstack/hub/field');
const Constraint = require('@cardstack/hub/constraint');
const ContentType = require('@cardstack/hub/content-type');
const DataSource = require('@cardstack/hub/data-source');
const Grant = require('@cardstack/hub/grant');
const Plugins = require('@cardstack/hub/plugins');
const logger = require('heimdalljs-logger');

const ownTypes = Object.freeze(['content-types', 'fields', 'constraints', 'data-sources', 'grants', 'plugin-configs', 'default-values']);

module.exports = class Schema {
  static ownTypes() {
    return ownTypes;
  }

  static async loadFrom(inputModels) {
    let models = inputModels;
    let plugins = await Plugins.load(models.filter(model => model.type === 'plugin-configs'));
    let authLog = logger('auth');
    let schemaLog = logger('schema');
    let constraints = findConstraints(models, plugins);
    let defaultValues = findDefaultValues(models);
    let grants = findGrants(models);
    let fields = findFields(models, plugins, constraints, grants, defaultValues, authLog);
    let dataSources = findDataSources(models, plugins);
    let defaultDataSource = findDefaultDataSource(plugins);
    schemaLog.debug('default data source %j', defaultDataSource);
    let types = findTypes(models, fields, dataSources, defaultDataSource, grants, authLog);
    return new this(types, fields, dataSources, inputModels, plugins);
  }

  constructor(types, fields, dataSources, originalModels, plugins) {
    this.types = types;
    this.fields = fields;
    this.dataSources = dataSources;
    this.plugins = plugins;
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
    let type, id;
    if (pendingChange.finalDocument) {
      // Create or update: check basic request document structure.
      this._validateDocumentStructure(pendingChange.finalDocument, context);
      type = pendingChange.finalDocument.type;
      id = pendingChange.finalDocument.id;
    } else {
      // Deletion. There's no request document to check.
      type = pendingChange.originalDocument.type;
      id = pendingChange.originalDocument.id;
    }

    let contentType = this.types.get(type);
    if (!contentType) {
      throw new Error(`"${type}" is not a valid type`, {
        status: 400,
        source: { pointer: '/data/type' }
      });
    }
    await contentType.validate(pendingChange, context);

    if (ownTypes.includes(type)) {
      // Safety check: the change we're about to approve is a schema
      // change. The following will deliberately blow up if the new
      // schema hits a bug anywhere in schema instantiation. Better to
      // serve a 500 here than accept the broken schema and serve 500s
      // to everyone.
      let newSchema = this.applyChange(type, id, pendingChange.finalDocument);
      if (newSchema !== this) {
        return newSchema;
      }
    }
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

function findConstraints(models, plugins) {
  let constraints = new Map();
  for (let model of models) {
    if (!ownTypes.includes(model.type)) {
      throw new Error(`attempted to load schema including non-schema type "${model.type}"`);
    }
    if (model.type === 'constraints') {
      constraints.set(model.id, new Constraint(model, plugins));
    }
  }
  return constraints;
}

function findDefaultValues(models) {
  let defaultValues = new Map();
  for (let model of models) {
    if (model.type === 'default-values') {
      defaultValues.set(model.id, model.attributes);
    }
  }
  return defaultValues;
}

function findGrants(models) {
  return models
    .filter(model => model.type === 'grants')
    .map(model => new Grant(model));
}

function findFields(models, plugins, constraints, grants, defaultValues, authLog) {
  let fields = new Map();
  for (let model of models) {
    if (model.type === 'fields') {
      fields.set(model.id, new Field(model, plugins, constraints, grants, defaultValues, authLog));
    }
  }
  return fields;
}

function findDataSources(models, plugins) {
  let dataSources = new Map();
  for (let model of models) {
    if (model.type === 'data-sources') {
      dataSources.set(model.id, new DataSource(model, plugins));
    }
  }
  return dataSources;
}

function findDefaultDataSource(plugins) {
  let serverConfig = plugins.configFor('@cardstack/hub');
  if (serverConfig && serverConfig['default-data-source']) {
    return serverConfig['default-data-source'];
  }
}

function findTypes(models, fields, dataSources, defaultDataSource, grants, authLog) {
  let types = new Map();
  for (let model of models) {
    if (model.type === 'content-types') {
      types.set(model.id, new ContentType(model, fields, dataSources, defaultDataSource, grants, authLog));
    }
  }
  return types;
}
