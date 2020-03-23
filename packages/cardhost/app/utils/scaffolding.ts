import { Card, AddressableCard } from '@cardstack/hub';
import { myOrigin } from './origin';
import DataService from '../services/data';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/hub';

export async function fieldCards(data: DataService): Promise<AddressableCard[]> {
  return await Promise.all(
    [
      { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'string-field' },
      { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'boolean-field' },
      { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'integer-field' },
      { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'date-field' },
      { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'datetime-field' },
      { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'url-field' },
      { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'image-reference-field' },
      { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'relative-image-reference-field' },
      { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'call-to-action-field' },
      { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' },
    ].map(id => data.load(id, 'everything'))
  );
}

export function getUserRealm() {
  return `${myOrigin}/api/realms/default`;
}

export async function loadModule(card: Card, localModulePath: string, exportedName = 'default') {
  // @ts-ignore
  let module = await import(`@cardstack/${card.csId}-card/${localModulePath}`); // we are using ESM for module loading
  return module[exportedName];
}

export const isolatedCssFile = 'isolated.css';
export const embeddedCssFile = 'embedded.css';
