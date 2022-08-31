import Helper from '@ember/component/helper';
import { Falsy, Maybe, UnsetValue } from './-private/shared';

type OrPair<A, B> = B extends UnsetValue
  ? A
  : Maybe<A> extends true
  ? NonNullable<A> | B
  : Falsy<A> extends true
  ? B
  : A | B;

interface OrHelperSignature<A, B, C, D, E> {
  Args: { Positional: [A, B?, C?, D?, E?] };
  Return: OrPair<OrPair<OrPair<OrPair<A, B>, C>, D>, E>;
}

export default class OrHelper<
  A,
  B = UnsetValue,
  C = UnsetValue,
  D = UnsetValue,
  E = UnsetValue
> extends Helper<OrHelperSignature<A, B, C, D, E>> {}
