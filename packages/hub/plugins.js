/*
  This module is scaffolding until we have a safe and dynamic plugin
  loader.

  Things a plugin will need to be able to provide:

   - ember components, helpers, models, etc. Like any other ember-addon.

   - Constraint implementations

   - Field implementations

   - base content (which necessarily includes both meta content (like
     content-types, fields, grants, etc) and content (like a welcome
     Post or default first User). These need to be layered beneath the
     user's own content, so they're overridable.

   - data-source implementations, which are compromised any of Writer,
     Indexer, and Searcher.

   - server endpoint implementations. These will have access to some
     curated set of public API involving the configured searcher and
     writers, etc.

   - authentication providers, which is

        - a function that maps from a token to { userRef, groupRefs
        }. Where by ref I mean { type, id}.

        - an ember service (API TBD) that exposes userRef to the app.

     An authentication provider can also be packaged with things like
     server endpoints (for issuing tokens) and content types (like a
     base user model and its fields) for a more complete experience.

*/

const denodeify = require('denodeify');
const fs = require('fs');
const path = require('path');
const readdir = denodeify(fs.readdir);
const log = require('heimdalljs-logger')('plugins');

const featureTypes = [
  'constraints',
  'fields',
  'writers',
  'searchers',
  'indexers',
  'authenticators',
  'middleware'
];
const javascriptPattern = /(.*)\.js$/;

module.exports = class Plugins {
  static async load(configModels) {
    let configs = new Map();
    configModels.forEach(model => {
      if (!model.attributes || !model.attributes.module) {
        throw new Error(`plugin-configs must have a module attribute. Found: (${model})`);
      }
      configs.set(model.attributes.module, Object.assign({}, model.attributes, model.relationships));
    });
    let features = (await Promise.all(configModels.map(loadPlugin))).reduce((a,b) => a.concat(b), []);
    return new this(configs, features);
  }
  constructor(configs, features) {
    this.configs = configs;
    for (let featureType of featureTypes) {
      this[featureType] = new Map();
    }
    for (let feature of features) {
      let qualifiedName;
      if (feature.name) {
        qualifiedName = `${feature.module}::${feature.name}`;
      } else {
        qualifiedName = feature.module;
      }
      this[feature.featureType].set(qualifiedName, feature);
    }
  }

  _lookup(featureType, fullyQualifiedName, optional) {
    if (!this[featureType]) {
      throw new Error(`Don't understand featureType ${featureType}`);
    }
    let feature = this[featureType].get(fullyQualifiedName);
    if (!feature && !optional) {
      throw new Error(`Unknown ${featureType} ${fullyQualifiedName}`);
    }
    return feature;
  }

  lookup(featureType, fullyQualifiedName) {
    let feature = this._lookup(featureType, fullyQualifiedName);
    if (!feature.cached) {
      feature.cached = require(feature.loadPath);
    }
    return feature.cached;
  }

  lookupOptional(featureType, fullyQualifiedName) {
    let feature = this._lookup(featureType, fullyQualifiedName, true);
    if (feature){
      if (!feature.cached) {
        feature.cached = require(feature.loadPath);
      }
      return feature.cached;
    }
  }


  loadPathFor(featureType, fullyQualifiedName) {
    let feature = this._lookup(featureType, fullyQualifiedName);
    return feature.loadPath;
  }

  // returns a list of [name, loaderFunc] where you can call
  // loaderFunc to get back the actual module.
  listAll(featureType) {
    if (!this[featureType]) {
      throw new Error(`Don't understand featureType ${featureType}`);
    }
    return [...this[featureType].entries()].map(([name]) => name);
  }

  configFor(moduleName) {
    return this.configs.get(moduleName);
  }
};

async function loadPlugin(pluginConfig) {
  let moduleName = pluginConfig.attributes.module;
  let packageJSON = path.join(moduleName, 'package.json');
  let moduleRoot = path.dirname(require.resolve(packageJSON));
  let json = require(packageJSON);
  if (!json.keywords || !json.keywords.includes('cardstack-plugin') || !json['cardstack-plugin']) {
    log.warn(`${moduleName} does not appear to be a cardstack plugin`);
    return [];
  }
  if (json['cardstack-plugin']['api-version'] !== 1) {
    log.warn(`${moduleName} has some fancy cardstack-plugin.version I don't understand. Trying anyway.`);
  }
  let customSource = json['cardstack-plugin'].src;
  if (customSource) {
    moduleRoot = path.join(moduleRoot, customSource);
  }
  return discoverFeatures(moduleName, moduleRoot);
}

async function discoverFeatures(moduleName, moduleRoot) {
  let features = [];
  for (let featureType of featureTypes) {
    try {
      let files = await readdir(path.join(moduleRoot, featureType));
      for (let file of files) {
        let m = javascriptPattern.exec(file);
        if (m) {
          features.push({
            module: moduleName,
            featureType,
            name: m[1],
            loadPath: path.join(moduleRoot, featureType, file),
            cached: null
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
        module: moduleName,
        featureType,
        name: null,
        loadPath: filename,
        cached: null
      });
    }
  }
  return features;
}


function singularize(name) {
  return name.replace(/s$/, '');
}
