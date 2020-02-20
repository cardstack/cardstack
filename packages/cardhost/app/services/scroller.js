import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import ENV from '@cardstack/cardhost/config/environment';

const { animationSpeed } = ENV;
const duration = animationSpeed || 1000;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

export default class ScrollerService extends Service {
  @tracked currentlyScrolledTo;
  @tracked isScrolling = false;
  @tracked scrollingElementSelector = '.library--main'; // refactor if we reuse this for something else

  setScrollingElement(element) {
    this.scrollingElementSelector = element;
  }

  scrollToSection({ selector, elementOffset = 60, doneScrolling }) {
    if (this.currentlyScrolledTo === selector) {
      return;
    }

    let element = document.querySelector(selector);
    let scrollingElement = document.querySelector(this.scrollingElementSelector);

    if (!element) {
      return;
    }

    this.isScrolling = true;

    let start = scrollingElement.scrollTop;
    let startTime = Date.now();
    let destinationOffset = Math.min(
      Math.max(element.offsetTop - elementOffset, 0),
      scrollingElement.scrollHeight - scrollingElement.offsetHeight
    );

    let animatedScroll = () => {
      if (this.isDestroyed) {
        return;
      }
      let now = Date.now();
      let time = Math.min(1, (now - startTime) / duration);
      let timeFunction = easeInOutCubic(time);
      scrollingElement.scroll(0, Math.ceil(timeFunction * (destinationOffset - start) + start));

      // if it's "close enough", stop :)
      if (Math.abs(Math.ceil(scrollingElement.scrollTop) - destinationOffset) < 2) {
        this.isScrolling = false;
        if (typeof doneScrolling === 'function') {
          doneScrolling();
        }
        return;
      }

      requestAnimationFrame(animatedScroll);
    };

    animatedScroll();

    this.currentlyScrolledTo = selector;
  }
}
