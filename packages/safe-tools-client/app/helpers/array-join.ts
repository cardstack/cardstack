import { helper } from '@ember/component/helper';

type PositionalArgs = [string[], string];

interface Signature {
  Args: {
    Positional: PositionalArgs;
  };
  Return: string;
}

export function joinArray([array, delimiter]: PositionalArgs) {
  return array.join(delimiter);
}

export default helper<Signature>(joinArray);
