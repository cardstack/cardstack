import { Card } from '@cardstack/core/card';
import { Expression } from '@cardstack/core/expression';

export function buildQueryExpression(source: Expression, fieldName: string) {
  return ['(', ...source, '->>', { param: fieldName }, ')::bigint'];
}

export async function validate(value: string, _fieldCard: Card) {
  return typeof value === 'number' && value === Math.floor(value) && value < Number.MAX_SAFE_INTEGER;
}
export async function deserialize(value: string, _fieldCard: Card) {
  return value;
}
