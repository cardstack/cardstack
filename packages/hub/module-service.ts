import { Card } from './card';

export class ModuleService {
  async load(_card: Card, _localModulePath: string, _exportedName: string): Promise<any> {
    return undefined;
  }
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    modules: ModuleService;
  }
}
