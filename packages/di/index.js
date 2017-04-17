const {
  Registry: GlimmerRegistry,
  Container: GlimmerContainer
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
};

function registerDeclaredInjections(registry, identifier, factory) {
  let declaredInjections = factory[injectionSymbol];
  if (declaredInjections) {
    for (let [property, dependency] of Object.entries(declaredInjections)) {
      registry.registerInjection(identifier, property, dependency);
    }
  }
}

// TODO: searchers should dynamically load like other feature plugins
const exceptions = {
  'hub:searchers': '@cardstack/elasticsearch/searcher'
};

class Resolver {
  constructor(registry, nextResolver) {
    this.registry = registry;
    this.nextResolver = nextResolver;
  }
  retrieve(specifier) {
    let module = exceptions[specifier];

    if (!module) {
      let [type, name] = specifier.split(':');
      if (type === 'hub') {
        module = `@cardstack/hub/${name}`;
      }
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
