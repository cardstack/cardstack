/* eslint-disable @typescript-eslint/no-explicit-any */
import Helper from '@ember/component/helper';

interface TruncateHelperSignature {
  Args: { Positional: [string, number, bool] | [string, number] | [string] };
  Return: string;
}

export default class TruncateHelper extends Helper<TruncateHelperSignature> {}
