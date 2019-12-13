export class Container {
  private cache = new Map() as Map<CacheKey, CacheEntry>;
  private teardownPromise: Promise<void[]> | undefined;

  constructor(private registry: Registry) {}

  async lookup<K extends keyof KnownServices>(name: K): Promise<KnownServices[K]>;
  async lookup(name: string): Promise<unknown>;
  async lookup(name: string): Promise<any> {
    let { promise, instance } = this._lookup(name);
    await promise;
    return instance;
  }

  private _lookup(name: string): CacheEntry {
    return this._instantiate(name, () => {
      let factory = this.lookupFactory(name);
      return new factory();
    });
  }

  private lookupFactory(name: string): Factory<any> {
    let factory = mappings.get(this.registry)!.get(name);
    if (!factory) {
      throw new Error(`no such service "${name}"`);
    }
    return factory;
  }

  // When this is called we'll always instantiate a new instance for each
  // invocation of instantiate(), as opposed to when .lookup() is used, where
  // there will only ever be 1 instance in the container. Consider the example
  // of using instantiate() to create an indexer for each realm--the desired
  // behavior is that there is a separate indexer instance for each realm--not
  // that they are all using the same indexer instance.
  async instantiate<T, A>(factory: FactoryWithArg<T, A>, arg: A): Promise<T>;
  async instantiate<T>(factory: Factory<T>): Promise<T>;
  async instantiate<T, A>(factory: any, arg?: A): Promise<T> {
    let { promise, instance } = this._instantiate(
      factory,
      () => {
        if (arguments.length === 1) {
          return new factory();
        } else {
          return new factory(arg);
        }
      },
      true
    );
    await promise;
    return instance;
  }

  private _instantiate<T>(identityKey: CacheKey, create: () => T, noCache?: boolean): CacheEntry {
    let cached = this.cache.get(identityKey);
    if (!noCache && cached) {
      return cached;
    }

    let pending = new Map() as PendingInjections;
    pendingInstantiationStack.unshift(pending);
    let instance: any;
    let result: CacheEntry;
    try {
      instance = create();
      ownership.set(instance, this);
      result = new CacheEntry(identityKey, instance, pending);
      this.cache.set(identityKey, result);
      for (let [name, entry] of pending.entries()) {
        entry.cacheEntry = this._lookup(name);
      }
    } finally {
      pendingInstantiationStack.shift();
    }
    return result;
  }

  async teardown() {
    if (!this.teardownPromise) {
      this.teardownPromise = Promise.all(
        [...this.cache.values()].map(async ({ promise, instance }) => {
          try {
            await promise;
          } catch (e) {
            // whoever originally called instantiate or lookup received a rejected promise and its their responsibility to handle it
          }
          if (typeof instance?.teardown === 'function') {
            await instance.teardown();
          }
        })
      );
    }

    await this.teardownPromise;
  }
}

export interface Factory<T> {
  new (): T;
}

export interface FactoryWithArg<T, A> {
  new (a: A): T;
}

class Deferred<T> {
  promise: Promise<T>;
  private resolve!: (result: T) => void;
  private reject!: (err: unknown) => void;
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
  fulfill(result: Promise<T>): void {
    result.then(this.resolve, this.reject);
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
    await Promise.all(
      [...subgraph].map(entry => {
        if (pendingReadyStack.includes(entry.identityKey)) {
          throw new Error(
            `circular dependency injection: ${[...pendingReadyStack, this.identityKey, entry.identityKey].join(' -> ')}`
          );
        }
        return entry.partial;
      })
    );
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

  async prepareInjection(name: string): Promise<void> {
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
        await pending.cacheEntry!.promise;
        this.installInjection(name, pending);
      })()
    );
    await cached.promise;
  }

  private async runReady(): Promise<void> {
    pendingReadyStack.push(this.identityKey);
    try {
      if (typeof this.instance.ready === 'function') {
        await this.instance.ready();
      }
    } finally {
      pendingReadyStack.pop();
    }
  }
}

type CacheKey = string | Function;

let mappings = new WeakMap() as WeakMap<Registry, Map<string, Factory<any>>>;
let pendingInstantiationStack = [] as PendingInjections[];
let ownership = new WeakMap() as WeakMap<any, Container>;
let pendingReadyStack = [] as CacheKey[];

export class Registry {
  constructor() {
    mappings.set(this, new Map());
  }
  register<T>(name: string, factory: Factory<T>) {
    // non-null because our constructor initializes weakmap.
    mappings.get(this)!.set(name, factory);
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

  import { inject, injectionReady } from '@cardstack/hub/dependency-injection';

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
  declare module "@cardstack/hub/dependency-injection" {
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
      await entry.prepareInjection(name);
      return;
    }
  }
}
