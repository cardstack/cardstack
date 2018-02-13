const Error = require('@cardstack/plugin-utils/error');
const Field = require('./schema/field');
const Constraint = require('./schema/constraint');
const ContentType = require('./schema/content-type');
const DataSource = require('./schema/data-source');
const Grant = require('./schema/grant');
const logger = require('@cardstack/logger');
const {
  declareInjections,
  getOwner
} = require('@cardstack/di');

const ownTypes = Object.freeze(['content-types', 'fields', 'constraints', 'input-assignments', 'data-sources', 'grants', 'plugin-configs', 'default-values']);

module.exports = declareInjections({
  pluginLoader: 'hub:plugin-loader'
},

class SchemaLoader {
  static create(opts) {
    return new this(opts);
  }

  constructor({ pluginLoader }) {
    this.pluginLoader = pluginLoader;
  }

  ownTypes() {
    return ownTypes;
  }

  async loadFrom(inputModels) {
    let models = inputModels;
    let plugins = await this.pluginLoader.configuredPlugins(models.filter(model => model.type === 'plugin-configs'));
    let authLog = logger('cardstack/auth');
    let schemaLog = logger('cardstack/schema');
    let defaultValues = findDefaultValues(models);
    let grants = findGrants(models);
    let fields = findFields(models, plugins, grants, defaultValues, authLog);
    let constraints = await findConstraints(models, plugins, fields);
    let dataSources = findDataSources(models, plugins);
    let defaultDataSource = findDefaultDataSource(plugins);
    schemaLog.trace('default data source %j', defaultDataSource);
    let types = findTypes(models, fields, constraints, dataSources, defaultDataSource, grants);
    validateRelatedTypes(types, fields);
    return getOwner(this).factoryFor('hub:schema').create({ types, fields, dataSources, inputModels, plugins });
  }
});

function findInputAssignments(models) {
  let inputAssignments = new Map();
  for (let model of models) {
    if (model.type === 'input-assignments') {
      inputAssignments.set(model.id, model);
    }
  }
  return inputAssignments;
}

async function findConstraints(models, plugins, fields) {
  let inputAssignments = findInputAssignments(models);
  let constraints = [];
  for (let model of models) {
    if (!ownTypes.includes(model.type)) {
      throw new Error(`attempted to load schema including non-schema type "${model.type}"`);
    }
    if (model.type === 'constraints') {
      constraints.push(await Constraint.create(model, plugins, inputAssignments, fields));
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

function findFields(models, plugins, types, grants, defaultValues, authLog) {
  let fields = new Map();
  for (let model of models) {
    if (model.type === 'fields') {
      fields.set(model.id, new Field(model, plugins, types, grants, defaultValues, authLog));
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
  let hubPlugin = plugins.describe('@cardstack/hub');
  if (hubPlugin && hubPlugin.relationships) {
    return hubPlugin.relationships['default-data-source'];
  }
}

function findTypes(models, fields, constraints, dataSources, defaultDataSource, grants) {
  let types = new Map();
  for (let model of models) {
    if (model.type === 'content-types') {
      types.set(model.id, new ContentType(model, fields, constraints, dataSources, defaultDataSource, grants));
    }
  }
  return types;
}

function validateRelatedTypes(types, fields) {
  for (let [fieldName, field] of fields.entries()) {
    if (field.relatedTypes) {
      for (let relatedTypeName of Object.keys(field.relatedTypes)) {
        if (!types.get(relatedTypeName)) {
          throw new Error(`field "${fieldName}" refers to missing related type "${relatedTypeName}"`, { status: 400 });
        }
      }
    }
  }
}
