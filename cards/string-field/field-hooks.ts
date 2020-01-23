import { Card } from '@cardstack/core/lib/card';

export async function validate(value: string, _fieldCard: Card) {
  return typeof value === 'string';
}
export async function deserialize(value: string, _fieldCard: Card) {
  return value;
}
