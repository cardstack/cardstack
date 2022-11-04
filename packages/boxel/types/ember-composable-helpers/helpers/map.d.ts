/* eslint-disable @typescript-eslint/no-explicit-any */
import Helper from '@ember/component/helper';

export default class MapHelper extends Helper<{
  Args: {
    Positional: [callback: (a: any) => any, array: unknown[]];
  };
  Return: any[];
}> {}
