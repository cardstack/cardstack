import { modifier } from 'ember-modifier';

interface AutoscrollOptions {
  onChildrenChanged?: () => void;
  onChildrenAdded?: (nodes: Array<HTMLElement>) => void;
  filter?: string; // css selector
  enabled?: boolean;
}

function contentsModified(
  element: HTMLElement,
  _optionsParams: unknown[] = [], // eslint-disable-line @typescript-eslint/no-unused-vars
  optionsHash: AutoscrollOptions = {}
) {
  function isHtmlElement(n: Node): n is HTMLElement {
    return n.nodeType === Node.ELEMENT_NODE;
  }

  const observer = new MutationObserver((mutationRecords) => {
    optionsHash.onChildrenChanged?.();

    let matchingNodes: HTMLElement[] = [];
    for (let m of mutationRecords) {
      for (let addedNode of m.addedNodes) {
        if (
          isHtmlElement(addedNode) &&
          (!optionsHash.filter ||
            (addedNode as HTMLElement).matches(optionsHash.filter))
        ) {
          matchingNodes.push(addedNode);
        }
      }
    }

    optionsHash.onChildrenAdded?.(matchingNodes);
  });

  observer.observe(element, {
    childList: true,
  });

  return function () {
    observer.disconnect();
  };
}

export default modifier(contentsModified);
