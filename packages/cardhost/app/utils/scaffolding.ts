import { Card } from '@cardstack/core/card';

export async function loadModule(card: Card, localModulePath: string, exportedName = 'default') {
  // @ts-ignore
  let module = await import(`@cardstack/${card.csId}-card/${localModulePath}`); // we are using ESM for module loading
  return module[exportedName];
}
