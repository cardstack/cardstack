import { Card } from '@cardstack/hub';

export async function validate(value: string, _fieldCard: Card) {
  return typeof value === 'string';
}
export async function deserialize(value: string, _fieldCard: Card) {
  return value;
}
