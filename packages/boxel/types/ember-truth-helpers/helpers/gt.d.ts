/* eslint-disable @typescript-eslint/no-explicit-any */
import Helper from '@ember/component/helper';

interface ComparisonHelperSignature {
  Args: { Positional: [any, any, { forceNumber?: boolean }?] };
  Return: boolean;
}

export default class ComparisonHelper extends Helper<ComparisonHelperSignature> {}
