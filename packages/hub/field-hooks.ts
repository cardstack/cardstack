import { Expression } from './expression';
import { FieldCard } from './card';

/*
  These hooks allow a card to customize how it behaves when used as a field
  inside another card.

  Serial is the type of your card's data when serialized within another card. By
  default, this is a JSON:API document, but cards that want to represent scalars
  can customize it.

  Value is the type that comes back when someone does `card.field('some-field')`
  where `some-field` is defined by your card. By default it is a Card instance,
  but cards that want to represent scalars can have a simpler value.
*/

export type validate<Serial> = (value: Serial, fieldCard: FieldCard) => Promise<boolean>;
export type deserialize<Serial, Value> = (value: Serial, fieldCard: FieldCard) => Promise<Value>;
export type buildQueryExpression = (source: Expression, name: string) => Expression;
export type buildValueExpression = (value: Expression) => Expression;
