import { modifier } from 'ember-modifier';

interface AutoscrollOptions {
  onElementVisible?: () => void;
  onElementHidden?: () => void;
  watchedElement?: HTMLElement;
  initArgs?: IntersectionObserverInit;
}

function visiblityChecker(
  element: HTMLElement,
  _optionsParams: unknown[] = [], // eslint-disable-line @typescript-eslint/no-unused-vars
  optionsHash: AutoscrollOptions = {}
) {
  if (!optionsHash.watchedElement) {
    return;
  }

  function handleVisibilityChange(entries: IntersectionObserverEntry[]) {
    let entry = entries[0];
    if (entry.isIntersecting) {
      optionsHash.onElementVisible?.();
    } else {
      optionsHash.onElementHidden?.();
    }
  }

  let initArgs = optionsHash.initArgs || {
    rootMargin: '0px',
    threshold: 0,
  };

  let observer = new IntersectionObserver(handleVisibilityChange, {
    root: element,
    ...initArgs,
  });

  observer.observe(optionsHash.watchedElement);

  return function () {
    observer.disconnect();
  };
}

export default modifier(visiblityChecker);
