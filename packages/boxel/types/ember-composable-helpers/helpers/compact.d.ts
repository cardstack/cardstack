/* eslint-disable @typescript-eslint/ban-types */
import Helper from '@ember/component/helper';

export default class CompactHelper<T> extends Helper<{
  Args: {
    Positional: [Array<T> | T];
  };
  Return: Array<T>;
}> {}
