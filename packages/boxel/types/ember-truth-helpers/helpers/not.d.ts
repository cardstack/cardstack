/* eslint-disable @typescript-eslint/no-explicit-any */
import Helper from '@ember/component/helper';

// NOTE: These types are somewhat imperfect.
// For instance, the limit at 5 is arbitrary. Also, the actual helpers
// use JavaScript truthiness along with special handling for empty arrays
// and objects with an `isTruthy` method. In these cases, we just won't
// narrow as much as we potentially could.

interface NotHelperSignature {
  Args: { Positional: any[] };
  Return: boolean;
}

export default class NotHelper extends Helper<NotHelperSignature> {}
