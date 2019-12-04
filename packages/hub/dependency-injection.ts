export class Container {
  private cache = new Map() as Map<CacheKey, CacheEntry>;
  private teardownPromise: Promise<void[]> | undefined;

  constructor(private registry: Registry) {}

  async lookup<K extends keyof KnownServices>(
    name: K
  ): Promise<KnownServices[K]>;
  async lookup(name: string): Promise<unknown>;
  async lookup(name: string): Promise<any> {
    let { promise } = this._lookup(name);
    return await promise;
  }

  _lookup(name: string): CacheEntry {
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

  async instantiate<T, A>(factory: FactoryWithArg<T, A>, arg: A): Promise<T>;
  async instantiate<T>(factory: Factory<T>): Promise<T>;
  async instantiate<T, A>(factory: any, arg?: A): Promise<T> {
    let { promise } = this._instantiate(factory, () => {
      if (arguments.length === 1) {
        return new factory();
      } else {
        return new factory(arg);
      }
    });
    return await promise;
  }

  private _instantiate<T>(identityKey: CacheKey, create: () => T): CacheEntry {
    let cached = this.cache.get(identityKey);
    if (cached) {
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
        [...this.cache.values()].map(async ({ promise }) => {
          let instance;
          try {
            instance = await promise;
          } catch (e) {
            // whoever originally called instantiate or lookup received a rejected promise and its their responsibility to handle it
          }
          if (typeof instance?.teardown === "function") {
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

class CacheEntry {
  private _promise: Promise<any> | undefined;

  constructor(
    private identityKey: CacheKey,
    readonly instance: any,
    private injections: PendingInjections
  ) {}

  get promise() {
    if (!this._promise) {
      this._promise = this.prepare();
    }
    return this._promise;
  }

  private async prepare(): Promise<any> {
    let circular = pendingPrepareStack.includes(this.identityKey);
    try {
      pendingPrepareStack.unshift(this.identityKey);
      if (circular) {
        throw new Error(`circular dependency injection: ${pendingPrepareStack.join(' -> ')}`);
      }
      await Promise.all(
        [...this.injections.entries()].map(
          async ([name, { opts, cacheEntry }]) => {
            let injectedValue = await cacheEntry!.promise;
            if (
              !this.instance[opts.as] ||
              this.instance[opts.as].injectionNotReadyYet !== name
            ) {
              throw new Error(
                `To assign 'inject("${name}")' to a property other than '${name}' you must pass the 'as' argument to inject().`
              );
            }
            this.instance[opts.as] = injectedValue;
          }
        )
      );
    } finally {
      pendingPrepareStack.shift();
    }

    if (typeof this.instance.ready === "function") {
      await this.instance.ready();
    }
    return this.instance;
  }
}

type CacheKey = string | Function;

let mappings = new WeakMap() as WeakMap<Registry, Map<string, Factory<any>>>;
let pendingInstantiationStack = [] as PendingInjections[];
let pendingPrepareStack = [] as CacheKey[];
let ownership = new WeakMap() as WeakMap<any, Container>;

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

  // when true, this injection will not be available inside your `ready` hook.
  // This can break cycles. It will still be available before we return your
  // instance out of the container.
  lazy: boolean;
}

interface PendingInjection {
  opts: InjectOptions;
  cacheEntry: CacheEntry | null;
}

type PendingInjections = Map<string, PendingInjection>;

/*
  Dependency Injection HOWTO

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
      // they are available everywhere else
      return this.thing;
    }

    async ready() {
      // if you have asynchronous setup work to do, implement a `ready` hook.
      // Other objects that inject you won't see you until after your ready resolves.

      // The Container will call your ready() method before returning your
      // instance to anyone.

      // ready is able to use injections, like every other method other than constructor.
      await this.weirdName().doSomething();
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
export function inject<K extends keyof KnownServices>(
  name: K,
  opts?: InjectOptions
): KnownServices[K];
export function inject(name: string, opts?: Partial<InjectOptions>): unknown {
  let pending = pendingInstantiationStack[0];
  if (!pending) {
    throw new Error(
      `Tried to directly instantiate an object with injections. Look it up in the container instead.`
    );
  }
  let completeOpts = Object.assign(
    {
      as: name,
      lazy: false
    },
    opts
  );
  pending.set(name, { opts: completeOpts, cacheEntry: null });
  return { injectionNotReadyYet: name };
}

export function getOwner(obj: any): Container {
  let container = ownership.get(obj);
  if (!container) {
    throw new Error(
      `Tried to getOwner of an object that didn't come from the container`
    );
  }
  return container;
}
