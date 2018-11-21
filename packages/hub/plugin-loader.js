const {
  declareInjections,
  getOwner,
  setOwner
} = require('@cardstack/di');
const path = require('path');
const log = require('@cardstack/logger')('cardstack/plugin-loader');
const denodeify = require('denodeify');
const resolve = denodeify(require('resolve'));
const fs = require('fs');
const realpath = denodeify(fs.realpath);
const readdir = denodeify(fs.readdir);
const Error = require('@cardstack/plugin-utils/error');
const { get } = require('lodash');

log.registerFormatter('t', require('./table-log-formatter'));

const featureTypes = [
  'constraint-types',
  'field-types',
  'computed-field-types',
  'writers',
  'searchers',
  'indexers',
  'static-models',
  'authenticators',
  'middleware',
  'routers',
  'messengers',
  'code-generators'
];
const javascriptPattern = /(.*)\.js$/;

module.exports = declareInjections({
  project: 'config:project',
  environment: 'config:environment'
},

class PluginLoader {
  static create(opts) {
    return new this(opts);
  }

  constructor({ project, environment }) {
    if (!project) {
      throw new Error("Missing configuration `config:project`");
    }

    if (!project.path) {
      throw new Error("`config:project` must have a `path`");
    }
    this.project = project;
    this.environment = get(environment, 'name');
    this._pluginsAndFeatures = null;
  }

  async _findPluginsAndFeatures() {
    let output = [];
    let seen = Object.create(null);

    let projectPath = path.resolve(this.project.path);
    log.info("starting from path %s", projectPath);

    // at the top-level (the project itself) we always include dev
    // deps. Not doing so under some conditions would be too big a
    // troll.
    let includeDevDependencies = true;

    await this._crawlPlugins(projectPath, output, seen, includeDevDependencies, []);

    let allFeatures = [];
    for (let plugin of output) {
      let features = await discoverFeatures(plugin.attributes.dir, plugin.id);
      plugin.relationships = {
        features: {
          data: features.map(({ type, id }) => ({ type, id }))
        },
        config: {
          data: { type: 'plugin-configs', id: plugin.id }
        }
      };
      allFeatures = allFeatures.concat(features);
    }
    log.info("=== found installed plugins===\n%t", () => summarize(output, allFeatures));
    return { installedPlugins: output, installedFeatures: allFeatures };
  }

  async installedPlugins() {
    if (!this._pluginsAndFeatures) {
      this._pluginsAndFeatures = this._findPluginsAndFeatures();
    }
    return (await this._pluginsAndFeatures).installedPlugins;
  }

  async installedFeatures() {
    if (!this._pluginsAndFeatures) {
      this._pluginsAndFeatures = this._findPluginsAndFeatures();
    }
    return (await this._pluginsAndFeatures).installedFeatures;
  }

  async configuredPlugins(configModels) {
    let configs = new Map();
    for (let model of configModels) {
      configs.set(model.id, model);
    }
    let installed = await this.installedPlugins();

    let missing = missingPlugins(installed, configs);
    if (missing.length > 0) {
      log.warn("Plugins are configured but not installed: %j", missing);
    }
    activateRecursively(installed, configs);
    let a = new ConfiguredPlugins(installed, await this.installedFeatures(), configs);
    setOwner(a, getOwner(this));
    return a;
  }

  async _crawlPlugins(dir, outputPlugins, seen, includeDevDependencies, breadcrumbs) {
    log.trace("plugin crawl dir=%s, includeDevDependencies=%s, breadcrumbs=%j", dir, includeDevDependencies, breadcrumbs);

    let realdir = await realpath(dir);
    if (seen[realdir]) {
      if (get(seen, `${dir}.attributes.includedFrom`)) {
        // if we've seen this dir before *and* it's a cardstack
        // plugin, we should update its includedFrom to include the
        // new path that we arrived by
        seen[realdir].attributes.includedFrom.push(breadcrumbs);
      }
      return;
    }

    let dupeModule;
    let packageJSON = path.join(realdir, 'package.json');
    let json = require(packageJSON);
    if ((dupeModule = Object.values(seen).find(i => i.id === json.name))) {
      let msg = action => `The plugin module name '${json.name}' has already been loaded from the module path ${dupeModule.attributes.rawDir}, ${action} load of module at path ${dir}.`;
      if (this.environment !== 'test') {
        log.warn(msg('skipping'));
      } else {
        throw new Error(msg('conflict with'));
      }
      if (get(dupeModule, 'attributes.includedFrom')) {
        dupeModule.attributes.includedFrom.push(breadcrumbs);
      }
      return;
    }

    seen[realdir] = true;
    let moduleRoot = path.dirname(await resolve(packageJSON, { basedir: this.project.path }));

    if (!json.keywords || !json.keywords.includes('cardstack-plugin') || !json['cardstack-plugin']) {
      // top-level app doesn't need to be a cardstack-plugin, but when
      // crawling any deeper dependencies we only care about them if
      // they are cardstack-plugins.
      if (breadcrumbs.length > 0) {
        log.trace(`%s does not appear to contain a cardstack plugin`, realdir);
        return;
      }
    } else {
      if (json['cardstack-plugin']['api-version'] !== 1) {
        log.warn(`%s has some fancy cardstack-plugin.version I don't understand. Trying anyway.`, realdir);
      }
      let customSource = json['cardstack-plugin'].src;
      if (customSource) {
        moduleRoot = path.join(moduleRoot, customSource);
      }
    }

    seen[realdir] = {
      id: json.name,
      type: 'plugins',
      attributes: {
        dir: moduleRoot,
        rawDir: dir,
        'is-root-plugin': breadcrumbs.length === 0,
        includedFrom: [breadcrumbs]
      }
    };

    outputPlugins.push(seen[realdir]);

    let deps = json.dependencies ? Object.keys(json.dependencies).map(dep => ({ dep, type: 'dependencies' })) : [];
    if (includeDevDependencies && json.devDependencies) {
      deps = deps.concat(Object.keys(json.devDependencies).map(dep => ({ dep, type: 'devDependencies' })));
    }

    if (json['cardstack-plugin']) {
      let dirs = json['cardstack-plugin']['in-repo-plugins'];
      if (dirs) {
        deps = deps.concat(dirs.map(dir => ({ dep: path.resolve(moduleRoot + '/' + dir), type: 'in-repo-plugins' })));
      }
    }

    for (let { dep, type } of deps) {
      let childDir = path.dirname(await resolve(dep + '/package.json', { basedir: realdir }));

      // we never include devDependencies of second level (or deeper) dependencies
      let includeDevDependencies = false;
      await this._crawlPlugins(childDir, outputPlugins, seen, includeDevDependencies, breadcrumbs.concat({ id: json.name, type }));
    }
  }

  static types() {
    return featureTypes;
  }

});

async function discoverFeatures(moduleRoot, pluginName) {
  let features = [];
  for (let featureType of featureTypes) {
    try {
      let files = await readdir(path.join(moduleRoot, featureType));
      for (let file of files) {
        let m = javascriptPattern.exec(file);
        if (m) {
          features.push({
            id: `${pluginName}::${m[1]}`,
            type: featureType,
            attributes: {
              'load-path': path.join(moduleRoot, featureType, file)
            },
            relationships: {
              plugin: {
                data: { type: 'plugins', id: pluginName }
              }
            }
          });
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') {
        throw err;
      }
    }

    let filename = path.join(moduleRoot, singularize(featureType) + '.js');
    if (fs.existsSync(filename)) {
      features.push({
        id: pluginName,
        type: featureType,
        attributes: {
          'load-path': filename
        },
        relationships: {
          plugin: {
            data: { type: 'plugins', id: pluginName }
          }
        }
      });
    }
  }
  return features;
}

function singularize(name) {
  return name.replace(/s$/, '');
}


class ConfiguredPlugins {
  constructor(installedPlugins, installedFeatures, configs) {
    this.rootPlugin = Object.create(null);
    this._plugins = Object.create(null);
    this._features = Object.create(null);

    installedPlugins.forEach(plugin => {
      let copied = Object.assign({}, plugin);
      let config = configs.get(plugin.id);
      if (config) {
        copied.attributes = Object.assign({}, plugin.attributes, config.attributes);
        if (copied.attributes.enabled !== false) {
          copied.attributes.enabled = true;
        }
        copied.relationships = Object.assign({}, plugin.relationships, config.relationships);
      } else {
        copied.attributes = Object.assign({}, plugin.attributes);
        copied.attributes.enabled = true;
      }
      this._plugins[copied.id] = copied;

      if (copied.attributes['is-root-plugin']) {
        this.rootPlugin = copied;
      }
    });

    featureTypes.forEach(type => this._features[type] = Object.create(null));

    installedFeatures.forEach(feature => {
      this._features[feature.type][feature.id] = feature;
    });
  }

  describeAll() {
    if (!this._describeAllCache) {
      this._describeAllCache = Object.values(this._plugins);
    }
    return this._describeAllCache;
  }

  describe(pluginName) {
    return this._plugins[pluginName];
  }

  describeFeature(featureType, featureName) {
    let typeSet = this._features[featureType];
    if (!typeSet) {
      throw new Error(`No such feature type "${featureType}"`);
    }
    return typeSet[featureName];
  }

  lookupFeature(featureType, fullyQualifiedName)  {
    return this._instance(this._lookupFeature(featureType, fullyQualifiedName));
  }

  lookupFeatureFactory(featureType, fullyQualifiedName)  {
    return this._factory(this._lookupFeature(featureType, fullyQualifiedName));
  }

  lookupFeatureAndAssert(featureType, fullyQualifiedName)  {
    return this._instance(this._lookupFeatureAndAssert(featureType, fullyQualifiedName));
  }

  lookupFeatureFactoryAndAssert(featureType, fullyQualifiedName)  {
    return this._factory(this._lookupFeatureAndAssert(featureType, fullyQualifiedName));
  }

  featuresOfType(featureType) {
    let typeSet = this._features[featureType];
    if (!typeSet) {
      throw new Error(`No such feature type "${featureType}"`);
    } else {
      return Object.values(typeSet).filter(feature => this._plugins[feature.relationships.plugin.data.id].attributes.enabled);
    }
  }

  _instance(resolverName) {
    if (resolverName) {
      return getOwner(this).lookup(resolverName);
    }
  }

  _factory(resolverName) {
    if (resolverName) {
      return getOwner(this).factoryFor(resolverName);
    }
  }

  _lookupFeature(featureType, fullyQualifiedName)  {
    let typeSet = this._features[featureType];
    if (typeSet) {
      let feature = typeSet[fullyQualifiedName];
      if (feature) {
        if (this._plugins[feature.relationships.plugin.data.id].attributes.enabled) {
          return resolverName(feature);
        }
      }
    }
  }

  _lookupFeatureAndAssert(featureType, fullyQualifiedName)  {
    let typeSet = this._features[featureType];
    if (typeSet) {
      let feature = typeSet[fullyQualifiedName];
      if (feature) {
        if (this._plugins[feature.relationships.plugin.data.id].attributes.enabled) {
          return resolverName(feature);
        } else {
          throw new Error(`You're trying to use ${featureType} ${fullyQualifiedName} but the plugin ${feature.relationships.plugin.data.id} is not activated`);
        }
      } else {
        let [moduleName] = fullyQualifiedName.split('::');
        if (this._plugins[moduleName]) {
          throw new Error(`You're trying to use ${featureType} ${fullyQualifiedName} but no such feature exists in plugin ${moduleName}`);
        } else {
          throw new Error(`You're trying to use ${featureType} ${fullyQualifiedName} but the plugin ${moduleName} is not installed. Make sure it appears in the dependencies section of package.json`);
        }
      }
    } else {
      throw new Error(`No such feature type "${featureType}"`);
    }
  }

}

function resolverName(feature) {
  let attrs = feature.attributes;
  return `plugin-${feature.type}:${attrs['load-path']}`;
}


function missingPlugins(installed, configs) {
  let missing = [];
  for (let pluginName of configs.keys()) {
    if (!installed.find(p => p.id === pluginName)) {
      missing.push(pluginName);
    }
  }
  return missing;
}

function summarize(plugins, features) {
  return plugins.map(p => {
    let pluginFeatures = features.filter(f => f.relationships.plugin.data.id === p.id);
    if (pluginFeatures.length > 0){
      return pluginFeatures.map(f => [p.id, f.type, f.id]);
    } else {
      return [[p.id, '']];
    }
  }).reduce((a,b) => a.concat(b), []);
}


function activateRecursively(installed, configs) {
  // The hub is always active, it doesn't really make sense to be here
  // if it isn't.
  if (!configs.get('@cardstack/hub')) {
    configs.set('@cardstack/hub', { moduleName: '@cardstack/hub' });
  }

  let dependsOn = dependencyGraph(installed);
  let queue = [...configs.keys()];
  let seen = Object.create(null);
  while (queue.length > 0) {
    let pluginName = queue.shift();
    if (seen[pluginName]) { continue; }
    seen[pluginName] = true;
    let deps = dependsOn[pluginName];
    if (deps) {
      for (let dep of deps) {
        if (!configs.get(dep)) {
          log.debug('Activating plugin %s because its used by %s', dep, pluginName);
          configs.set(dep, { moduleName: dep });
          queue.push(dep);
        }
      }
    }
  }
}

// This only includes "dependencies", not "devDependencies" or
// "in-repo-plugins" (only "dependencies" are things that must always
// be both installed and active when you are active).
function dependencyGraph(installed) {
  let dependsOn = Object.create(null);
  for (let plugin of installed) {
    for (let breadcrumbs of plugin.attributes.includedFrom) {
      let parent = breadcrumbs[breadcrumbs.length - 1];
      if (!parent || parent.type !== 'dependencies') { continue; }
      if (!dependsOn[parent.id]) {
        dependsOn[parent.id] = [ plugin.id ];
      } else {
        dependsOn[parent.id].push(plugin.id);
      }
    }
  }
  log.debug('=== plugin dependency graph ===\n%t', () => Object.keys(dependsOn).map(k => dependsOn[k].map(v => [k,v])).reduce((a,b) => a.concat(b)));
  return dependsOn;
}
