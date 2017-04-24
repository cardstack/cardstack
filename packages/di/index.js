const {
  Registry: GlimmerRegistry,
  Container: GlimmerContainer,
  setOwner,
  getOwner
} = require('@glimmer/di');

const injectionSymbol = Symbol('@cardstack/di/injections');

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
  }
  retrieve(specifier) {
    let module;
    let [type, name] = specifier.split(':');
    if (type === 'hub') {
      module = `@cardstack/hub/${name}`;
    } else if (type === 'middleware') {
      module = name;
    } else if (type === 'searcher') {
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
