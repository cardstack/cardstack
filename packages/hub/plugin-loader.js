const {
  declareInjections,
  getOwner,
  setOwner
} = require('@cardstack/di');
const path = require('path');
const log = require('@cardstack/plugin-utils/logger')('plugin-loader');
const denodeify = require('denodeify');
const resolve = denodeify(require('resolve'));
const fs = require('fs');
const realpath = denodeify(fs.realpath);
const readdir = denodeify(fs.readdir);
const Error = require('@cardstack/plugin-utils/error');

// provides "%t" in debug logger
require('./table-log-formatter');

const featureTypes = [
  'constraints', // TODO: rename to constraint-types
  'fields',      // TODO: rename to field-types
  'writers',
  'searchers',
  'indexers',
  'authenticators',
  'middleware',
  'messengers',
  'code-generators'
];
const javascriptPattern = /(.*)\.js$/;
const TOP_FEATURE = {};

module.exports = declareInjections({
  project: 'config:project'
},

class PluginLoader {
  static create(opts) {
    return new this(opts);
  }

  constructor({ project }) {
    if (!project) {
      throw new Error("Missing configuration `config:project`");
    }

    if (!project.path) {
      throw new Error("`config:project` must have a `path`");
    }
    this.project = project;
    this._installedPlugins = null;
  }

  async installedPlugins() {
    return publicNames(await this._findInstalledPlugins());
  }

  async _findInstalledPlugins() {
    if (!this._installedPlugins) {
      let output = [];
      let seen = Object.create(null);

      // during a test suite, we include devDependencies of the top-level project under test.
      let includeDevDependencies = this.project.allowDevDependencies;
      let projectPath = path.resolve(this.project.path);
      log.info("starting from path %s", projectPath);
      log.info("allowed in devDependencies: %s", !!includeDevDependencies);
      await this._crawlPlugins(projectPath, output, seen, includeDevDependencies, []);
      this._installedPlugins = output;
      log.info("=== found installed plugins===\n%t", () => summarize(output));
    }
    return this._installedPlugins;
  }

  async activePlugins(configModels) {
    let configs = new Map();
    for (let model of configModels) {
      if (!model.attributes || !model.attributes.module) {
        throw new Error(`plugin-configs must have a module attribute. Found: (${model})`);
      }
      configs.set(model.attributes.module, Object.assign({}, model.attributes, model.relationships));
    }
    let installed = await this._findInstalledPlugins();

    let missing = missingPlugins(installed, configs);
    if (missing.length > 0) {
      log.warn("Plugins are configured but not installed: %j", missing);
    }

    let a = new ActivePlugins(installed, configs);
    setOwner(a, getOwner(this));
    return a;
  }

  async _crawlPlugins(dir, output, seen, includeDevDependencies, breadcrumbs) {
    log.trace("plugin crawl dir=%s, includeDevDependencies=%s, breadcrumbs=%j", dir, includeDevDependencies, breadcrumbs);
    if (seen[dir]) {
      return;
    }
    seen[dir] = true;
    dir = await realpath(dir);
    let packageJSON = path.join(dir, 'package.json');
    let moduleRoot = path.dirname(await resolve(packageJSON, { basedir: this.project.path }));

    let json = require(packageJSON);

    if (!json.keywords || !json.keywords.includes('cardstack-plugin') || !json['cardstack-plugin']) {
      // top-level app doesn't need to be a cardstack-plugin, but when
      // crawling any deeper dependencies we only care about them if
      // they are cardstack-plugins.
      if (breadcrumbs.length > 0) {
        log.trace(`${dir} does not appear to contain a cardstack plugin`);
        return;
      }
    } else {
      if (json['cardstack-plugin']['api-version'] !== 1) {
        log.warn(`${dir} has some fancy cardstack-plugin.version I don't understand. Trying anyway.`);
      }
      let customSource = json['cardstack-plugin'].src;
      if (customSource) {
        moduleRoot = path.join(moduleRoot, customSource);
      }
    }
    output.push({
      name: json.name,
      dir: moduleRoot,
      features: await discoverFeatures(moduleRoot),
      includedFrom: breadcrumbs
    });

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
      let childDir = path.dirname(await resolve(dep + '/package.json', { basedir: dir }));

      // we never include devDependencies of second level dependencies
      await this._crawlPlugins(childDir, output, seen, false, breadcrumbs.concat({ name: json.name, type }));
    }
  }
});

async function discoverFeatures(moduleRoot) {
  let features = [];
  for (let featureType of featureTypes) {
    try {
      let files = await readdir(path.join(moduleRoot, featureType));
      for (let file of files) {
        let m = javascriptPattern.exec(file);
        if (m) {
          features.push({
            type: featureType,
            name: m[1],
            loadPath: path.join(moduleRoot, featureType, file)
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
        type: featureType,
        name: TOP_FEATURE,
        loadPath: filename
      });
    }
  }
  return features;
}

function singularize(name) {
  return name.replace(/s$/, '');
}


class ActivePlugins {
  constructor(installedPlugins, configs) {
    activateRecursively(installedPlugins, configs);
    this.installedPlugins = installedPlugins;
    this.configs = configs;
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

  configFor(moduleName) {
    return this.configs.get(moduleName);
  }

  listAll(featureType) {
    return this.installedPlugins.map(p => {
      return p.features.filter(
        f => f.type === featureType && this.configFor(p.name)
      ).map(f => {
          if (f.name === TOP_FEATURE) {
            return p.name;
          } else {
            return `${p.name}::${f.name}`;
          }
        });
    }).reduce((a,b) => a.concat(b), []);
  }

  _instance(identifier) {
    if (identifier) {
      return getOwner(this).lookup(identifier);
    }
  }

  _factory(identifier) {
    if (identifier) {
      return getOwner(this).factoryFor(identifier);
    }
  }

  _lookupFeature(featureType, fullyQualifiedName)  {
    let [moduleName, featureName] = fullyQualifiedName.split('::');
    if (this.configs.get(moduleName)) {
      let plugin = this.installedPlugins.find(p => p.name === moduleName);
      if (plugin) {
        let feature = this._findFeature(plugin.features, featureType, featureName);
        log.trace('feature lookup %s %s %s', featureType, fullyQualifiedName, !!feature);
        return feature;
      }
    }
    log.trace('feature lookup %s %s %s', featureType, fullyQualifiedName, false);
  }

  _lookupFeatureAndAssert(featureType, fullyQualifiedName)  {
    let [moduleName, featureName] = fullyQualifiedName.split('::');
    let config = this.configs.get(moduleName);
    let plugin = this.installedPlugins.find(p => p.name === moduleName);
    let feature;
    if (plugin) {
      feature = this._findFeature(plugin.features, featureType, featureName);
    }
    if (!plugin) {
      throw new Error(`You're trying to use ${featureType} ${fullyQualifiedName} but the plugin ${moduleName} is not installed. Make sure it appears in the dependencies section of package.json`);
    }
    if (!feature) {
      throw new Error(`You're trying to use ${featureType} ${fullyQualifiedName} but no such feature exists in plugin ${moduleName}`);
    }
    if (!config) {
      throw new Error(`You're trying to use ${featureType} ${fullyQualifiedName} but the plugin ${moduleName} is not activated`);
    }
    return feature;
  }

  _findFeature(features, featureType, featureName) {
    if (!featureTypes.includes(featureType)) {
      throw new Error(`No such feature type "${featureType}"`);
    }
    let feature = features.find(
      f => f.type === featureType && f.name === (featureName || TOP_FEATURE)
    );
    if (feature) {
      return `plugin-${featureType}:${feature.loadPath}`;
    }
  }

}

function missingPlugins(installed, configs) {
  let missing = [];
  for (let pluginName of configs.keys()) {
    if (!installed.find(p => p.name === pluginName)) {
      missing.push(pluginName);
    }
  }
  return missing;
}

function summarize(plugins) {
  return publicNames(plugins).map(p => {
    if (p.features.length > 0){
      return p.features.map(f => [p.name, f.type, f.name]);
    } else {
      return [[p.name, '']];
    }
  }).reduce((a,b) => a.concat(b), []);
}


function publicNames(plugins) {
  return plugins.map(p => ({
    name: p.name,
    features: p.features.map(f => ({
      type: f.type,
      name: f.name === TOP_FEATURE ? p.name : `${p.name}::${f.name}`
    }))
  }));
}

function activateRecursively(installed, configs) {
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
    let parent = plugin.includedFrom[plugin.includedFrom.length - 1];
    if (!parent || parent.type !== 'dependencies') { continue; }
    if (!dependsOn[parent.name]) {
      dependsOn[parent.name] = [ plugin.name ];
    } else {
      dependsOn[parent.name].push(plugin.name);
    }
  }
  log.debug('=== plugin dependency graph ===\n%t', () => Object.keys(dependsOn).map(k => dependsOn[k].map(v => [k,v])).reduce((a,b) => a.concat(b)));
  return dependsOn;
}
