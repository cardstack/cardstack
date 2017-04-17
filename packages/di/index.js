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

const wellKnown = {
  'schema-cache:main': '@cardstack/hub/schema-cache',
  'writers:main': '@cardstack/hub/writers',
  'searcher:main': '@cardstack/elasticsearch/searcher',
  'indexers:main': '@cardstack/hub/indexers',
  'encryptor:main': '@cardstack/hub/encryptor',
  'authentication:main': '@cardstack/hub/authentication'
};

class Resolver {
  constructor(registry, nextResolver) {
    this.registry = registry;
    this.nextResolver = nextResolver;
  }
  retrieve(specifier) {
    if (wellKnown[specifier]) {
      let factory = require(wellKnown[specifier]);
      registerDeclaredInjections(this.registry, specifier, factory);
      return factory;
    }
    if (this.nextResolver) {
      return this.nextResolver.retrieve(specifier);
    }
  }
}
