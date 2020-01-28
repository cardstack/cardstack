import { Card } from '@cardstack/core/card';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';

export function loadModule(card: Card, localModulePath: string, exportedName?: string) {
  if (localModulePath === 'field-hooks.js' && exportedName) {
    return loadFieldHooks(card, exportedName);
  }
  return new Error(`unimplemented module: ${localModulePath} for card ${card.canonicalURL}`);
}

function loadFieldHooks(card: Card, hook: string) {
  if (card.csRealm === CARDSTACK_PUBLIC_REALM && card.csId === 'string-field') {
    if (hook === 'validate') {
      return validateString;
    }
    if (hook === 'deserialize') {
      return deserialize;
    }
  }
  if (card.csRealm === CARDSTACK_PUBLIC_REALM && card.csId === 'boolean-field') {
    if (hook === 'validate') {
      return validateBoolean;
    }
    if (hook === 'deserialize') {
      return deserialize;
    }
  }
  if (card.csRealm === CARDSTACK_PUBLIC_REALM && card.csId === 'integer-field') {
    if (hook === 'validate') {
      return validateInteger;
    }
    if (hook === 'deserialize') {
      return deserialize;
    }
  }
  return new Error(`unimplemented field hook: ${hook} for card ${card.canonicalURL}`);
}

export async function validateString(value: string, _fieldCard: Card) {
  return typeof value === 'string';
}
export async function validateBoolean(value: string, _fieldCard: Card) {
  return typeof value === 'boolean';
}
export async function validateInteger(value: string, _fieldCard: Card) {
  return typeof value === 'number' && value === Math.floor(value) && value < Number.MAX_SAFE_INTEGER;
}
export async function deserialize(value: string, _fieldCard: Card) {
  return value;
}
