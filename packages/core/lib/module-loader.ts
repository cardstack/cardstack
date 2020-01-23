import { Card } from '@cardstack/core/lib/card';

export interface ModuleLoader {
  load(card: Card, localModulePath: string, exportedName?: string): Promise<any>;
}
