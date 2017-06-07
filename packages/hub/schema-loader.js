const Field = require('./field');
const Constraint = require('./constraint');
const ContentType = require('./content-type');
const DataSource = require('./data-source');
const Grant = require('./grant');
const logger = require('@cardstack/plugin-utils/logger');
const {
  declareInjections,
  getOwner
} = require('@cardstack/di');

const ownTypes = Object.freeze(['content-types', 'fields', 'constraints', 'data-sources', 'grants', 'plugin-configs', 'default-values']);

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
    let plugins = await this.pluginLoader.activePlugins(models.filter(model => model.type === 'plugin-configs'));
    let authLog = logger('auth');
    let schemaLog = logger('schema');
    let constraints = await findConstraints(models, plugins);
    let defaultValues = findDefaultValues(models);
    let grants = findGrants(models);
    let fields = findFields(models, plugins, constraints, grants, defaultValues, authLog);
    let dataSources = findDataSources(models, plugins);
    let defaultDataSource = findDefaultDataSource(plugins);
    schemaLog.debug('default data source %j', defaultDataSource);
    let types = findTypes(models, fields, dataSources, defaultDataSource, grants, authLog);
    return getOwner(this).factoryFor('hub:schema').create({ types, fields, dataSources, inputModels, plugins });
  }
});

async function findConstraints(models, plugins) {
  let constraints = new Map();
  for (let model of models) {
    if (!ownTypes.includes(model.type)) {
      throw new Error(`attempted to load schema including non-schema type "${model.type}"`);
    }
    if (model.type === 'constraints') {
      constraints.set(model.id, await Constraint.create(model, plugins));
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
