export class Container {
  constructor(private registry: Registry) {}

  async lookup<K extends keyof KnownServices>(name: K): Promise<KnownServices[K]>;
  async lookup(name: string): Promise<unknown>;
  async lookup(name: string): Promise<any> {
    let factory = mappings.get(this.registry)!.get(name);
    if (!factory) {
      throw new Error(`no such service "${name}"`);
    }

    let pending = [] as PendingInjection[];
    pendingInjections.unshift(pending);
    let instance: any;
    try {
      instance = new factory();
    } finally {
      pendingInjections.shift();
    }

    await Promise.all(pending.map(async p => {
      let injectedValue = await this.lookup(p.name);
      if (!instance[p.opts.as] || instance[p.opts.as].injectionNotReadyYet !== p.name) {
        throw new Error(`To assign 'inject("${p.name}")' to a property other than '${p.name}' you must pass the 'as' argument to inject().`);
      }
      instance[p.opts.as] = injectedValue;
    }));

    if (typeof instance.ready === 'function') {
      await instance.ready();
    }

    return instance;
  }
}

interface Factory<T = any> {
  new(): T;
}

let mappings = new WeakMap() as WeakMap<Registry, Map<string, Factory>>;
let pendingInjections = [] as PendingInjection[][];

export class Registry {
  constructor() {
    mappings.set(this, new Map());
  }
  register(name: string, factory: Factory) {
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

export function inject<K extends keyof KnownServices>(name: K, opts?: InjectOptions): KnownServices[K];
export function inject(name: string, opts?: InjectOptions): unknown {
  let pending = pendingInjections[0];
  if (!pending) {
    throw new Error(`Tried to directly instantiate an object with injections. Look it up in the container instead.`);
  }
  if (!opts) {
    opts = { as: name };
  }
  pending.push({ name, opts });
  return { injectionNotReadyYet: name };
}
