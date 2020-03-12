import { Card } from '@cardstack/core/card';

export async function validate(value: string, _fieldCard: Card) {
  let isValidUrl;
  try {
    new URL(value);
    isValidUrl = true;
  } catch (e) {
    isValidUrl = false;
  }
  return isValidUrl;
}
export async function deserialize(value: string, _fieldCard: Card) {
  return new URL(value);
}
