import { Memoize } from 'typescript-memoize';
import { Deferred } from './deferred';
import { Container as ContainerInterface, Factory, isFactoryByCreateMethod } from './container';
import kebabCase from 'lodash/kebabCase';
import walkSync from 'walk-sync';
import { find } from 'lodash';

let nonce = 0;

export class Container implements ContainerInterface {
  private cache = new Map() as Map<CacheKey, CacheEntry>;
  private tearingDown: Deferred<void> | undefined;

  constructor(private registry: Registry) {}

  async lookup<K extends keyof KnownServices>(name: K): Promise<KnownServices[K]>;
  async lookup(name: string): Promise<unknown>;
  async lookup(name: string): Promise<any> {
    let { promise, instance } = await this._lookup(name);
    await promise;
    return instance;
  }

  private async _lookup(name: string): Promise<CacheEntry> {
    let cached = this.cache.get(name);
    if (cached) {
      return cached;
    }

    let factory = await this.lookupFactory(name);
    return this.provideInjections(() => {
      let instance: any;
      if (isFactoryByCreateMethod(factory)) {
        instance = factory.create();
      } else {
        instance = new factory();
      }
      return instance;
    }, name);
  }

  private async lookupFactory(name: string): Promise<Factory<any>> {
    let factory = mappings.get(this.registry)!.get(name);

    if (!factory) {
      factory = await this.registry.tryToFindFactory(name);
      if (!factory) {
        throw new Error(`no such service "${name}"`);
      }
      this.registry.register(name, factory);
    }

    return factory;
  }

  // When this is called we'll always instantiate a new instance for each
  // invocation of instantiate(), as opposed to when .lookup() is used, where
  // there will only ever be 1 instance in the container. Consider the example
  // of using instantiate() to create an indexer for each realm. The desired
  // behavior is that there is a separate indexer instance for each realm--not
  // that they are all using the same indexer instance.
  //
  // When you use instantiate, you are responsible for calling teardown on the
  // returned object.
  async instantiate<T, A extends unknown[]>(factory: Factory<T, A>, ...args: A): Promise<T> {
    let { instance, promise } = await this.provideInjections(() => {
      if (isFactoryByCreateMethod(factory)) {
        return factory.create(...args);
      } else {
        return new factory(...args);
      }
    });

    await promise;
    return instance;
  }

  private async provideInjections<T>(create: () => T, cacheKey?: CacheKey): Promise<CacheEntry> {
    let pending = new Map() as PendingInjections;
    pendingInstantiationStack.unshift(pending);
    let result: CacheEntry;
    try {
      let instance = create();
      ownership.set(instance, this);
      result = new CacheEntry(cacheKey ?? `anonymous_${nonce++}`, instance, pending);
      if (cacheKey) {
        this.cache.set(cacheKey, result);
      }
      for (let [name, entry] of pending.entries()) {
        entry.cacheEntry = await this._lookup(name);
      }
    } finally {
      pendingInstantiationStack.shift();
    }
    return result;
  }

  async teardown() {
    if (!this.tearingDown) {
      this.tearingDown = new Deferred();
      this.tearingDown.fulfill(
        (async () => {
          // first phase: everybody's willTeardown resolves. Each instance
          // promises that it will not *initiate* new calls to its injections
          // after resolving willTeardown. You may still call your injections in
          // response to being called by someone who injected you.
          await Promise.all(
            [...this.cache.values()].map(async ({ promise, instance }) => {
              try {
                await promise;
              } catch (e) {
                // whoever originally called instantiate or lookup received a rejected promise and its their responsibility to handle it
              }
              if (typeof instance?.willTeardown === 'function') {
                await instance.willTeardown();
              }
            })
          );

          // Once everybody has resolved willTeardown, we know there are no more
          // inter-instance functions that will run, so we can destroy
          // everything.
          await Promise.all(
            [...this.cache.values()].map(async ({ instance }) => {
              if (typeof instance?.teardown === 'function') {
                await instance.teardown();
              }
            })
          );
        })()
      );
    }

    await this.tearingDown.promise;
  }
}

class CacheEntry {
  private deferredPartial: Deferred<void> | undefined;
  private deferredPromise: Deferred<void> | undefined;
  private deferredInjections: Map<string, Deferred<void>> = new Map();

  constructor(private identityKey: CacheKey, readonly instance: any, private injections: PendingInjections) {}

  // resolves when this CacheEntry is fully ready to be used
  get promise(): Promise<void> {
    if (!this.deferredPromise) {
      this.deferredPromise = new Deferred();
      this.deferredPromise.fulfill(this.prepareSubgraph());
    }
    return this.deferredPromise.promise;
  }

  private async prepareSubgraph(): Promise<void> {
    let subgraph = this.subgraph();
    await Promise.all([...subgraph].map((entry) => entry.partial));
    for (let entry of subgraph) {
      for (let [name, pending] of entry.injections) {
        entry.installInjection(name, pending);
      }
    }
  }

  private installInjection(name: string, pending: PendingInjection) {
    if (pending.isReady) {
      return;
    }
    let { opts, cacheEntry } = pending;
    if (!this.instance[opts.as] || this.instance[opts.as].injectionNotReadyYet !== name) {
      throw new Error(
        `To assign 'inject("${name}")' to a property other than '${name}' you must pass the 'as' argument to inject().`
      );
    }
    this.instance[opts.as] = cacheEntry!.instance;
    pending.isReady = true;
  }

  @Memoize()
  private subgraph(): Set<CacheEntry> {
    let subgraph = new Set() as Set<CacheEntry>;
    let queue: CacheEntry[] = [this];
    while (true) {
      let entry = queue.shift();
      if (!entry) {
        break;
      }
      subgraph.add(entry);
      for (let { cacheEntry } of entry.injections.values()) {
        if (!subgraph.has(cacheEntry!)) {
          queue.push(cacheEntry!);
        }
      }
    }
    return subgraph;
  }

  // resolves when the instance's ready hook has run. This implies that any
  // forced-eager injections that ready() uses will be present, but does *not*
  // imply that all other injections are present.
  get partial(): Promise<void> {
    if (!this.deferredPartial) {
      this.deferredPartial = new Deferred();
      this.deferredPartial.fulfill(this.runReady());
    }
    return this.deferredPartial.promise;
  }

  async prepareInjectionEagerly(name: string): Promise<void> {
    let cached = this.deferredInjections.get(name);
    if (cached) {
      await cached.promise;
      return;
    }
    cached = new Deferred();
    this.deferredInjections.set(name, cached);
    cached.fulfill(
      (async () => {
        let pending = this.injections.get(name)!;
        if (pending.cacheEntry?.subgraph().has(this)) {
          throw new Error(
            `circular dependency: ${this.identityKey} tries to eagerly inject ${name}, which depends on ${this.identityKey}`
          );
        }
        await pending.cacheEntry!.promise;
        this.installInjection(name, pending);
      })()
    );
    await cached.promise;
  }

  private async runReady(): Promise<void> {
    if (typeof this.instance.ready === 'function') {
      await this.instance.ready();
    }
  }
}

type CacheKey = string;

let mappings = new WeakMap() as WeakMap<Registry, Map<string, Factory<any>>>;
let pendingInstantiationStack = [] as PendingInjections[];
let ownership = new WeakMap() as WeakMap<any, Container>;

interface RegistryOptions {
  findFactory: Registry['findFactory'];
  rootDir?: Registry['rootDir'];
  factoryGlobs?: Registry['factoryGlobs'];
}

export class Registry {
  private findFactory: (importPath: string) => Promise<any> | void;
  private rootDir: string;
  private factoryGlobs: string[];
  private importPossibilities: string[] = [];

  constructor(options: RegistryOptions) {
    this.findFactory = options.findFactory;
    this.rootDir = options.rootDir ?? process.cwd();
    this.factoryGlobs = options.factoryGlobs ?? [];

    mappings.set(this, new Map());

    this.importPossibilities = this.findImportPossibilities();
  }

  register<T>(name: string, factory: Factory<T>) {
    // non-null because our constructor initializes weakmap.
    mappings.get(this)!.set(name, factory);
  }

  findInImportPosibilities(name: string) {
    // kebabCase converts web3 to web-3 which is bad
    let fileName = kebabCase(name).replace('-3-', '3-');

    let possibility = find(this.importPossibilities, (e) => {
      return e.endsWith(fileName + '.ts');
    });
    if (!possibility) {
      return;
    }
    return possibility.replace(/\.ts&/, '');
  }

  async tryToFindFactory(name: string): Promise<any | void> {
    let path = this.findInImportPosibilities(name);
    if (!path) {
      return;
    }
    let factory = await this.findFactory(path);
    if (!factory || !factory.default) {
      return;
    }
    return factory.default;
  }

  private findImportPossibilities() {
    return walkSync
      .entries(this.rootDir, {
        globs: this.factoryGlobs,
        ignore: ['**/*.d.ts'],
        fs: undefined as any,
      })
      .map((entry) => './' + entry.relativePath);
  }
}

// This exists to be extended by authors of services
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface KnownServices {}

interface InjectOptions {
  // if you are storing your injection in a property whose name doesn't match
  // the key it was registered under, you need to pass the property name here.
  as: string;
}

interface PendingInjection {
  opts: InjectOptions;
  cacheEntry: CacheEntry | null;
  isReady: boolean;
}

type PendingInjections = Map<string, PendingInjection>;

/*
  Dependency Injection HOWTO

  import { inject, injectionReady } from '@cardstack/hub/di/dependency-injection';

  class YourClass {

    // the default pattern is to use the same name for your local property as
    // the name of the service you're looking up.
    thing = inject('thing');

    // If you want a different local property name, you need to tell inject
    // about it. We can't see it otherwise.
    weirdName = inject('something', { as: 'weirdName' });

    constructor() {
      // your injections aren't available in the constructor! If you try
      // to access them here you'll find they are just placeholder objects.
    }

    someMethod() {
      // they are available everywhere else (except the ready hook, see below)
      return this.thing;
    }

    async ready() {
      // if you have asynchronous setup work to do, implement a `ready` hook.
      // Other objects that inject you won't see you until after your ready resolves.

      // The Container will call your ready() method before returning your
      // instance to anyone.

      // ready is *not* guaranteed to have access to the injections, because
      // that would require us to make all of them eager, which makes dependency
      // cycles into deadlock even when they're not actually needed during ready().
      //
      // Instead, if you want to use an injection during ready() you need to use
      // await injectionReady:
      await injectionReady(this, 'thing');
      this.thing.doStuff();
    }
  }

  // This is the type declaration for what other people will get
  // when they inject you or do container.lookup(). Notice that you
  // may want to register a slightly different interface here than
  // your actual implementation, because others will only see you after
  // ready() has resolved, which may make your public interface cleaner.
  declare module "@cardstack/hub/di/dependency-injection" {
    interface KnownServices {
      yourClass: YourClass;
    }
  }
*/
export function inject<K extends keyof KnownServices>(name: K, opts?: InjectOptions): KnownServices[K];
export function inject(name: string, opts?: Partial<InjectOptions>): unknown {
  let pending = pendingInstantiationStack[0];
  if (!pending) {
    throw new Error(`Tried to directly instantiate an object with injections. Look it up in the container instead.`);
  }
  let completeOpts = Object.assign(
    {
      as: name,
    },
    opts
  );
  pending.set(name, { opts: completeOpts, cacheEntry: null, isReady: false });
  return { injectionNotReadyYet: name };
}

export function getOwner(obj: any): Container {
  let container = ownership.get(obj);
  if (!container) {
    throw new Error(`Tried to getOwner of an object that didn't come from the container`);
  }
  return container;
}

export async function injectionReady(instance: any, name: string): Promise<void> {
  let container = getOwner(instance);

  // accessing a private member variable
  let cache: Container['cache'] = (container as any).cache;

  for (let entry of cache.values()) {
    if (entry.instance === instance) {
      await entry.prepareInjectionEagerly(name);
      return;
    }
  }
}
