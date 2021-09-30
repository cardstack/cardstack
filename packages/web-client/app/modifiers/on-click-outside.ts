import { guidFor } from '@ember/object/internals';
import { modifier } from 'ember-modifier';

interface OnClickOutsideOptions {
  ignoreSelector?: string;
}

function onClickOutside(
  element: HTMLElement,
  [clickAction]: Function[],
  optionsHash: OnClickOutsideOptions = {}
) {
  if (!element.id) {
    element.id = guidFor(element);
  }

  function onClick(event: MouseEvent) {
    if (!event.target || !(event.target as HTMLElement).closest) return;

    let target = event.target as HTMLElement;
    if (target.closest(`#${element.id}`)) return;
    if (optionsHash.ignoreSelector) {
      if (target.closest(optionsHash.ignoreSelector)) return;
    }

    clickAction();
    event.preventDefault();
    event.stopPropagation();
  }
  document.addEventListener('click', onClick, { capture: true });

  return function () {
    document.removeEventListener('click', onClick, { capture: true });
  };
}

export default modifier(onClickOutside);
