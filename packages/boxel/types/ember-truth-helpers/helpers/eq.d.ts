/* eslint-disable @typescript-eslint/no-explicit-any */
import Helper from '@ember/component/helper';

interface EqualityHelperSignature {
  Args: { Positional: [any, any] };
  Return: boolean;
}

export default class EqualityHelper extends Helper<EqualityHelperSignature> {}
