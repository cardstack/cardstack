export class Container {
  private cache = new Map() as Map<string | Function, Promise<any>>;
  private teardownPromise: Promise<void[]> | undefined;

  constructor(private registry: Registry) {}

  async lookup<K extends keyof KnownServices>(
    name: K
  ): Promise<KnownServices[K]>;
  async lookup(name: string): Promise<unknown>;
  async lookup(name: string): Promise<any> {
    let cached = this.cache.get(name);
    if (!cached) {
      let factory = this.lookupFactory(name);
      cached = this._instantiate(factory);
      this.cache.set(name, cached);
    }
    return await cached;
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
    let cached = this.cache.get(factory);
    if (!cached) {
      cached = this._instantiate(factory, arg);
      this.cache.set(factory, cached);
    }
    return await cached;
  }

  private async _instantiate<T, A>(
    factory: FactoryWithArg<T, A>,
    arg: A
  ): Promise<T>;
  private async _instantiate<T>(factory: Factory<T>): Promise<T>;
  private async _instantiate<T, A>(factory: any, arg?: A): Promise<T> {
    let pending = [] as PendingInjection[];
    pendingInjections.unshift(pending);
    let instance: any;
    try {
      if (arg === undefined) {
        instance = new factory();
      } else {
        instance = new factory(arg);
      }
    } finally {
      pendingInjections.shift();
    }

    await Promise.all(
      pending.map(async p => {
        let injectedValue = await this.lookup(p.name);
        if (
          !instance[p.opts.as] ||
          instance[p.opts.as].injectionNotReadyYet !== p.name
        ) {
          throw new Error(
            `To assign 'inject("${p.name}")' to a property other than '${p.name}' you must pass the 'as' argument to inject().`
          );
        }
        instance[p.opts.as] = injectedValue;
      })
    );

    if (typeof instance.ready === "function") {
      await instance.ready();
    }
    ownership.set(instance, this);
    return instance;
  }

  async teardown() {
    if (!this.teardownPromise) {
      this.teardownPromise = Promise.all(
        [...this.cache.values()].map(async promise => {
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

let mappings = new WeakMap() as WeakMap<Registry, Map<string, Factory<any>>>;
let pendingInjections = [] as PendingInjection[][];
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
  as: string;
}

interface PendingInjection {
  name: string;
  opts: InjectOptions;
}

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
export function inject(name: string, opts?: InjectOptions): unknown {
  let pending = pendingInjections[0];
  if (!pending) {
    throw new Error(
      `Tried to directly instantiate an object with injections. Look it up in the container instead.`
    );
  }
  if (!opts) {
    opts = { as: name };
  }
  pending.push({ name, opts });
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
