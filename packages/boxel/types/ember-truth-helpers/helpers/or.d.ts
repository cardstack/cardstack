import Helper from '@ember/component/helper';
import { Falsy, Maybe, UnsetValue } from './-private/shared';

// NOTE: These types are somewhat imperfect.
// For instance, the limit at 5 is arbitrary. Also, the actual helpers
// use JavaScript truthiness along with special handling for empty arrays
// and objects with an `isTruthy` method. In these cases, we just won't
// narrow as much as we potentially could.

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
