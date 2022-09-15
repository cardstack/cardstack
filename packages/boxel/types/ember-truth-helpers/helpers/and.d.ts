import Helper from '@ember/component/helper';
import { Falsy, UnsetValue } from './-private/shared';

// NOTE: These types are somewhat imperfect.
// For instance, the limit at 5 is arbitrary. Also, the actual helpers
// use JavaScript truthiness along with special handling for empty arrays
// and objects with an `isTruthy` method. In these cases, we just won't
// narrow as much as we potentially could.

type AndPair<A, B> = Falsy<A> extends true
  ? A
  : B extends UnsetValue
  ? A
  : A | B;

interface AndHelperSignature<A, B, C, D, E> {
  Args: { Positional: [A, B?, C?, D?, E?] };
  Return: AndPair<A, AndPair<B, AndPair<C, AndPair<D, E>>>>;
}

export default class AndHelper<
  A,
  B = UnsetValue,
  C = UnsetValue,
  D = UnsetValue,
  E = UnsetValue
> extends Helper<AndHelperSignature<A, B, C, D, E>> {}
