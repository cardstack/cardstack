import { Card } from '@cardstack/hub';

export interface ModuleLoader {
  load(card: Card, localModulePath: string, exportedName?: string): Promise<any>;
}
