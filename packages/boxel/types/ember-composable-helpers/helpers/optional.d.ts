/* eslint-disable @typescript-eslint/ban-types */
import Helper from '@ember/component/helper';

export default class OptionalHelper<T extends Function> extends Helper<{
  Args: {
    Positional: [func?: T];
  };
  Return: T;
}> {}
