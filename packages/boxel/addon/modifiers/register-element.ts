import { modifier } from 'ember-modifier';

type PositionalArgs = [(element: HTMLElement | undefined) => void];

interface Signature {
  Element: HTMLElement;
  Args: {
    Positional: PositionalArgs;
  };
}

function registerElement(element: HTMLElement, [callback]: PositionalArgs) {
  callback(element);
}

export default modifier<Signature>(registerElement, { eager: false });
