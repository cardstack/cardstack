import { inject, InjectOptions, Registry } from '@cardstack/di';

export function registerQueries(registry: Registry) {
  registry.registerType('query', async (name) => (await import(`./${name}`)).default);
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface KnownQueries {}

declare module '@cardstack/di' {
  interface TypedKnownServices {
    query: KnownQueries;
  }
}

export function query<Name extends keyof KnownQueries>(
  name: Name,
  opts?: Omit<InjectOptions, 'type'>
): KnownQueries[Name] {
  return inject(name, { type: 'query', ...opts });
}
