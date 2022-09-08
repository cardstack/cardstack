/* eslint-disable @typescript-eslint/no-explicit-any */
import Helper from '@ember/component/helper';

interface NotHelperSignature {
  Args: { Positional: any[] };
  Return: boolean;
}

export default class NotHelper extends Helper<NotHelperSignature> {}
