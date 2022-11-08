/* eslint-disable @typescript-eslint/no-explicit-any */
import Helper from '@ember/component/helper';

export default class SetHelper extends Helper<{
  Args: {
    Positional: [obj: unknown, propertyName: string, value?: unknown];
  };
  Return: any;
}> {}
