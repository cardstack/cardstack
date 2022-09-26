import Helper from '@ember/component/helper';

interface ToggleSignature<T, K extends keyof T> {
  Args: {
    Positional: [key: K, obj: T, ...values: T[K][]] | [key: K, obj: T];
  };
  Return: () => void;
}

export default class ToggleHelper<T, K extends keyof T> extends Helper<
  ToggleSignature<T, K>
> {}
