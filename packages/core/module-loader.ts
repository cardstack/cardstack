import { Card } from './card';

export interface ModuleLoader {
  load(card: Card, localModulePath: string, exportedName?: string): Promise<any>;
}
