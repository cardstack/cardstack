import Helper from '@ember/component/helper';
import { ComponentLike } from '@glint/template';

export default class ElementHelper<
  K extends keyof HTMLElementTagNameMap
> extends Helper<{
  Args: {
    Positional: [tagName: K];
  };
  Return: ComponentLike<{
    Element: HTMLElementTagNameMap[K];
    Yields: { default: [] };
  }>;
}> {}
