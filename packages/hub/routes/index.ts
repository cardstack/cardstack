import { inject, InjectOptions, Registry } from '@cardstack/di';

export function registerRoutes(registry: Registry) {
  registry.registerType('route', async (name) => (await import(`./${name}`)).default);
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface KnownRoutes {}

declare module '@cardstack/di' {
  interface TypedKnownServices {
    route: KnownRoutes;
  }
}

export function route<Name extends keyof KnownRoutes>(
  name: Name,
  opts?: Omit<InjectOptions, 'type'>
): KnownRoutes[Name] {
  return inject(name, { type: 'route', ...opts });
}
