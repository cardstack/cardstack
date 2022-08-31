import Helper from '@ember/component/helper';

interface Signature {
  Args: {
    Positional: [string];
  };
  Return: void;
}

export default class SetBodyClassHelper extends Helper<Signature> {}
