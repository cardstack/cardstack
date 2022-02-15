import { modifier } from 'ember-modifier';

/**
 * This modifier is kind of awkward. Layouts behave as if the scaled element
 * is still the same width as before, so we need to add a negative margin for height.
 * It allows insertion of arbitrary content for previews - we need this for workflows
 * to follow the layout size while displaying previews using the same components (except scaled down);
 * and for the image editor to do the same, if necessary. I'm imagining the image editor to
 * allow clicking on a scaled-down component and seeing a blown up version; though that is more
 * of a possible future improvement.
 *
 * Possible improvements to this modifier:
 * - make a component that uses scale-down-to-width internally/ applies similar logic and wraps a containing div around.
 *   - to avoid the margin bottom from not being overwritable.
 *   - to have the scale in state, as a number that can be displayed optionally / provided
 * - window resize handling
 */

/**
 * Sets an element's width to a given width,
 * and scale its child down to fit that width.
 * Only supports one HTML Element child at the moment.
 *
 * @param element The container element
 * @param params Array of length 1 that contains a single string for the width of the element
 */
function scaleDownToWidth(element: HTMLElement, params: string[]) {
  element.style.width = params[0];
  element.style.overflow = 'visible';

  let children = element.children as HTMLCollection;
  if (!children.length) {
    return;
  }

  if (children.length > 1) {
    throw new Error(
      'scale-down-to-width cannot support more than one child node'
    );
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

export default modifier(scaleDownToWidth);
