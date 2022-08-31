/* eslint-disable @typescript-eslint/no-explicit-any */
import Helper from '@ember/component/helper';

interface OptionalHelperSignature {
  Args: { Positional: [((event: Event) => void) | undefined] };
  Return: (event: Event) => void;
}

export default class OptionalHelper extends Helper<OptionalHelperSignature> {}
