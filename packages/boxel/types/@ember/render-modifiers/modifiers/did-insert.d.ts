/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Helper from '@ember/component/helper';

interface Signature {
  Args: {
    Positional: [fn: Function, ...args: any[]];
    Named: any;
  };
  Return: any;
}

export default class DidInsertHelper extends Helper<Signature> {}
