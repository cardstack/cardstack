import { helper } from '@ember/component/helper';

type PositionalArgs = [];

interface Signature {
  Args: {
    Positional: PositionalArgs;
  };
  Return: void;
}

// Helper that does nothing. Intended for use in templates where passing a function is mandatory but we don't want to do anything.
export function noop() {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  // return () => {};
}

export default helper<Signature>(noop);
