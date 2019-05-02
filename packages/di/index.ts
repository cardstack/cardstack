import {
  Registry as GlimmerRegistry,
  Container as GlimmerContainer,
  setOwner,
  FactoryDefinition,
  RegistrationOptions,
  Resolver as GlimmerResolver,
  Factory
} from '@glimmer/di';
import resolve from 'resolve';
import path from 'path';
import { RegistryOptions } from '@glimmer/di/dist/types/registry';
const specifierPattern = /([^:]+):(.*)/;

// Tolerate multiple distinct copies of this module
if (!(global as any).__cardstackInjectionSymbol__) {
  (global as any).__cardstackInjectionSymbol__ = Symbol('@cardstack/di/injections');
}
const injectionSymbol = (global as any).__cardstackInjectionSymbol__;

interface Injections {
  [name: string]: string;
}

export function declareInjections<T>(injections: Injections, klass: T) {
  (klass as any)[injectionSymbol] = injections;

  if (!(klass as any).create) {
    (klass as any).create = function (injectedArgs: { [key: string]: any }) {
      return Object.assign(new this(), injectedArgs);
    };
  }

  return klass;
}

export class Registry extends GlimmerRegistry {
  constructor(options: RegistryOptions) {
    super(options);

    this.registerOption('config', 'instantiate', false);

    // These are the feature types that are not supposed to be
    // instantiated. Possibly we should just make them all be
    // instantiated anyway for consistency.
    for (let type of [
      'constraint-types',
      'field-types'
    ]) {
      this.registerOption(`plugin-${type}`, 'instantiate', false);
    }
  }

  register(identifier: string, factoryDefinition: FactoryDefinition<any>, options?: RegistrationOptions) {
    let result = super.register(identifier, factoryDefinition, options);
    registerDeclaredInjections(this, identifier, factoryDefinition);
    return result;
  }
}

export class Container extends GlimmerContainer {
  _teardownPromises: (Promise<void> | void)[];
  constructor(registry: GlimmerRegistry, nextResolver: Resolver) {
    super(registry, new Resolver(registry, nextResolver));
    this._teardownPromises = [];
  }
  lookup(specifier: string): any {
    let result = super.lookup(specifier);
    if (result) {
      setOwner(result, this);
    }
    return result;
  }
  identify(): string {
    // this stubbed function exists only to satisfy inherited typing
    return '';
  }
  factoryFor(specifier: string): Factory<any> {
    let result = super.factoryFor(specifier);
    if (result) {
      return {
        class: result.class,
        create: (options) => {
          let instance = result.create(options);
          setOwner(instance, this);
          return instance;
        },
        teardown: (specifier) => {
          this._teardownPromises.push(result.teardown(specifier));
        }
      };
    }
    return result;
  }
  teardownSettled() {
    return Promise.all(this._teardownPromises);
  }
}

function registerDeclaredInjections(registry: GlimmerRegistry, identifier: string, factoryDefinition: FactoryDefinition<any>) {
  let declaredInjections: Injections = (factoryDefinition as any)[injectionSymbol];
  if (declaredInjections) {
    for (let [property, dependency] of Object.entries(declaredInjections)) {
      registry.registerInjection(identifier, property, dependency);
    }
  }
}

class Resolver implements GlimmerResolver {
  private _hubPath: string | null
  constructor(public registry: GlimmerRegistry, public nextResolver: Resolver) {
    this._hubPath = null;
  }

  identify(): string {
    // this stubbed function exists only to satisfy inherited typing
    return '';
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

      let project = this.registry.registration('config:project') as unknown as { path: string } | undefined;
      if (!project) {
        throw new Error(`Failed to locate hub because config:project is not registered`);
      }
      if (!project.path) {
        throw new Error(`Failed to locate hub because config:project does not contain a "path"`);
      }
      try  {
        // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
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
  retrieve(specifier: string): any {
    let module;
    let m = specifierPattern.exec(specifier);
    if (m) {
      let [, type, name] = m;
      if (type === 'hub') {
        module = this.hubPath + '/' + name;
      } else if (/^plugin-/.test(type)) {
        module = name;
      }
      if (module) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
        let factory = require(module);
        registerDeclaredInjections(this.registry, specifier, factory);
        return factory;
      }
    }

    if (this.nextResolver) {
      return this.nextResolver.retrieve(specifier);
    }
  }
}

export { getOwner, setOwner } from '@glimmer/di';
