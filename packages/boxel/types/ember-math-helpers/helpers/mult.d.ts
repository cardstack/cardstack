/* eslint-disable @typescript-eslint/no-explicit-any */
import Helper from '@ember/component/helper';

interface Signature {
  Args: { Positional: number[] };
  Return: number;
}

export default class MultHelper extends Helper<Signature> {}
