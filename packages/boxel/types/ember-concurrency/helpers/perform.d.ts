/* eslint-disable @typescript-eslint/no-explicit-any */
import Helper from '@ember/component/helper';

interface Signature {
  Args: {
    Positional: [task: any, ...args: any[]];
    Named: {
      value?: any;
    };
  };
  Return: any;
}

export default class PerformHelper extends Helper<Signature> {}
