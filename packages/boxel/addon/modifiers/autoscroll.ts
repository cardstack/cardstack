import { modifier } from 'ember-modifier';

interface AutoscrollOptions {
  lockThreshold?: number;
}

const DEFAULT_LOCK_THRESHOLD = 10;

// The {{autoscroll}} modifer uses a MutationObserver to monitor the DOM within the modified element
// and scroll the element to the bottom when new children are added, if and only if the element is
// already scrolled to the bottom or "near" the bottom. You can specify the threshold for "near" like
// so: {{autoscroll lockThreshold=15}} (within 15px of the bottom). The default lockThreshold is 10px.

function autoscroll(
  element: HTMLElement,
  _optionsParams: unknown[] = [], // eslint-disable-line @typescript-eslint/no-unused-vars
  optionsHash: AutoscrollOptions = {}
) {
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

export default modifier(autoscroll);
