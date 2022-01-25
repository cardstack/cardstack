import { modifier } from 'ember-modifier';

/**
 * Scale an element's child down to fit a given width
 *
 * @param element The container element
 * @param params Array of length 1 that contains a single string for the width of the element
 */
function scaleToFit(element: HTMLElement, params: string[]) {
  element.style.width = params[0];
  element.style.overflow = 'visible';

  let children = element.children as HTMLCollection;
  if (!children.length) {
    return;
  }

  if (children.length > 1) {
    throw new Error('scale-to-fit cannot support multiple children');
  }

  let child = children[0] as HTMLElement;
  if (child.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  let originalHeight = child.offsetHeight;
  let ratio = element.offsetWidth / (child as HTMLElement).offsetWidth;
  if (ratio > 1) {
    return;
  }

  let difference = originalHeight * (1 - ratio);
  element.style.marginBottom = `-${difference}px`;

  (child as HTMLElement).style.transform = 'scale(' + ratio + ')';
  (child as HTMLElement).style.transformOrigin = 'top left';
}

export default modifier(scaleToFit);
