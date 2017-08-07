const {
  Registry: GlimmerRegistry,
  Container: GlimmerContainer,
  setOwner,
  getOwner
} = require('@glimmer/di');
const resolve = require('resolve');
const path = require('path');

// Tolerate multiple distinct copies of this module
if (!global.__cardstack_injection_symbol__) {
  global.__cardstack_injection_symbol__ = Symbol('@cardstack/di/injections');
}
const injectionSymbol = global.__cardstack_injection_symbol__;

exports.declareInjections = function(injections, klass) {
  klass[injectionSymbol] = injections;

  if (!klass.create) {
    klass.create = function (injectedArgs) {
      return Object.assign(new this(), injectedArgs);
    };
  }

  return klass;
};

exports.Registry = class Registry extends GlimmerRegistry {
  constructor(...args) {
    super(...args);

    this.registerOption('config', 'instantiate', false);

    // These are the feature types that are not supposed to be
    // instantiated. Possibly we should just make them all be
    // instantiated anyway for consistency.
    for (let type of [
      'constraint-types',
      'field-types',
      'docker-services'
    ]) {
      this.registerOption(`plugin-${type}`, 'instantiate', false);
    }
  }

  register(identifier, factory, options) {
    let result = super.register(identifier, factory, options);
    registerDeclaredInjections(this, identifier, factory);
    return result;
  }
};

exports.Container = class Container extends GlimmerContainer {
  constructor(registry, nextResolver) {
    super(registry, new Resolver(registry, nextResolver));
  }
  lookup(...args) {
    let result = super.lookup(...args);
    if (result) {
      setOwner(result, this);
    }
    return result;
  }
  factoryFor(...args) {
    let result = super.factoryFor(...args);
    if (result) {
      return {
        class: result.class,
        create: (options) => {
          let instance = result.create(options);
          setOwner(instance, this);
          return instance;
        },
        teardown: result.teardown
      };
    }
  }
};

function registerDeclaredInjections(registry, identifier, factory) {
  let declaredInjections = factory[injectionSymbol];
  if (declaredInjections) {
    for (let [property, dependency] of Object.entries(declaredInjections)) {
      registry.registerInjection(identifier, property, dependency);
    }
  }
}

class Resolver {
  constructor(registry, nextResolver) {
    this.registry = registry;
    this.nextResolver = nextResolver;
    this._hubPath = null;
  }
  get hubPath() {
    if (!this._hubPath) {

      /*
         There are two ways to find @cardstack/hub. Either the
         top-level project must directly depend on it (this is what
         apps are supposed to do) or the top-level project may depend
         on @cardstack/test-support which depends on @cardstack/hub
         (this is what plugins can do).
      */

      let project = this.registry.registration('config:project');
      if (!project) {
        throw new Error(`Failed to locate hub because config:project is not registered`);
      }
      if (!project.path) {
        throw new Error(`Failed to locate hub because config:project does not contain a "path"`);
      }
      try  {
        let p = require(project.path + '/package.json');
        let deps = Object.keys(p.dependencies || {}).concat(Object.keys(p.devDependencies || {}));
        if (deps.includes('@cardstack/hub')) {
          this._hubPath = path.dirname(resolve.sync(`@cardstack/hub`, { basedir: project.path }));
        } else if (deps.includes('@cardstack/test-support')) {
          let testSupport = path.dirname(resolve.sync(`@cardstack/test-support`, { basedir: project.path }));
          this._hubPath = path.dirname(resolve.sync(`@cardstack/hub`, { basedir: testSupport }));
        } else {
          throw new Error(`${project.path} does not depend on the hub or test-support`);
        }
      } catch (err) {
        if (!/Cannot find module/i.test(err)) {
          throw err;
        } else {
          throw new Error(`Failed to locate hub relative to ${project.path}`);
        }
      }
    }
    return this._hubPath;
  }
  retrieve(specifier) {
    let module;
    let [type, name] = specifier.split(':');
    if (type === 'hub') {
      module = this.hubPath + '/' + name;
    } else if (/^plugin-/.test(type)) {
      module = name;
    }

    if (module) {
      let factory = require(module);
      registerDeclaredInjections(this.registry, specifier, factory);
      return factory;
    }

    if (this.nextResolver) {
      return this.nextResolver.retrieve(specifier);
    }
  }
}

exports.getOwner = getOwner;
exports.setOwner = setOwner;
