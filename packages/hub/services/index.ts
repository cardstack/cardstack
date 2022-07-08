import { inject, InjectOptions, Registry } from '@cardstack/di';
import { kebabCase } from 'lodash';

export function registerServices(registry: Registry) {
  registry.registerType('service', async (name) => {
    let filename = kebabCase(name);
    return (
      await import(
        /* webpackExclude: /assets/ */
        `./${filename}`
      )
    ).default;
  });
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HubServices {}

declare module '@cardstack/di' {
  interface TypedKnownServices {
    service: HubServices;
  }
}

export function service<Name extends keyof HubServices>(
  name: Name,
  opts?: Omit<InjectOptions, 'type'>
): HubServices[Name] {
  return inject(name, { type: 'service', ...opts });
}
