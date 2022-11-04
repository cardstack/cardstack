import Helper from '@ember/component/helper';

interface Signature {
  Args: {
    Positional: [keyCombo: string, callback: (ev: KeyboardEvent) => void];
    Named: {
      event?: string;
      activated?: boolean;
      priority?: number;
    };
  };
  Return: void;
}

export default class OnKeyHelper extends Helper<Signature> {}
