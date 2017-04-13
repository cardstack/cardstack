const {
  Registry: GlimmerRegistry,
  Container
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
    let declaredInjections = factory[injectionSymbol];
    if (declaredInjections) {
      for (let [property, dependency] of Object.entries(declaredInjections)) {
        this.registerInjection(identifier, property, dependency);
      }
    }
    return result;
  }
};

exports.Container = Container;
