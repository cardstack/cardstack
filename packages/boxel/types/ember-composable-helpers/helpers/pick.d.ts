/* eslint-disable @typescript-eslint/ban-types */
import Helper from '@ember/component/helper';

export default class PickHelper extends Helper<{
  Args: {
    Positional: [path: string, func?: Function];
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Return: any;
}> {}
