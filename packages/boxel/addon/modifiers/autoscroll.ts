import { modifier } from 'ember-modifier';

interface AutoscrollOptions {
  enabled?: boolean;
  lockThreshold?: number;
}

interface Signature {
  Element: HTMLElement;
  Args: {
    Positional: [];
    Named: AutoscrollOptions;
  };
}

const DEFAULT_LOCK_THRESHOLD = 10;

// The {{autoscroll}} modifer uses a MutationObserver to monitor the DOM within the modified element
// and scroll the element to the bottom when new children are added, if and only if the element is
// already scrolled to the bottom or "near" the bottom. You can specify the threshold for "near" like
// so: {{autoscroll lockThreshold=15}} (within 15px of the bottom). The default lockThreshold is 10px.

function autoscroll(
  element: HTMLElement,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _optionsParams: [] = [],
  optionsHash: AutoscrollOptions = {}
) {
  // if the 'enabled' property was provided and falsey (including null and undefined), we consider this disabled
  // when we used Object.prototype.hasOwnProperty, getOwnPropertyDescriptor caused
  // a failing assertion in tests with ember-source@3.27
  if (
    Reflect.ownKeys(optionsHash).includes('enabled') &&
    !optionsHash.enabled
  ) {
    return;
  }

  const options = {
    ...optionsHash,
  };
  let lockThreshold = options.lockThreshold ?? DEFAULT_LOCK_THRESHOLD;

  let isLocked = false;

  function scrollDown() {
    element.scrollTo({
      top: element.scrollHeight,
      left: 0,
      behavior: 'smooth',
    });
  }

  function updateIsLocked() {
    let scrollFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    isLocked = scrollFromBottom > lockThreshold;
  }

  element.addEventListener('scroll', updateIsLocked);
  updateIsLocked();

  const observer = new MutationObserver(() => {
    if (!isLocked) {
      scrollDown();
    }
  });
  observer.observe(element, {
    childList: true,
    subtree: true,
  });

  return function () {
    observer.disconnect();
    element.removeEventListener('scroll', updateIsLocked);
  };
}

export default modifier<Signature>(autoscroll, { eager: false });
