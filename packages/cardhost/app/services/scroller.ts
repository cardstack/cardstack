import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
//@ts-ignore
import ENV from '@cardstack/cardhost/config/environment';

const { animationSpeed } = ENV;
const duration = animationSpeed || 1000;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

export default class ScrollerService extends Service {
  @tracked isScrolling = false;
  @tracked scrollingElementSelector = '.library--main'; // refactor if we reuse this for something else

  setScrollingElement(selector: string) {
    this.scrollingElementSelector = selector;
  }

  scrollToSection({
    selector,
    elementOffset = 60,
    doneScrolling,
  }: {
    selector: string;
    elementOffset: number;
    doneScrolling: () => void;
  }) {
    let element = document.querySelector(selector) as HTMLElement;
    let scrollingElement = document.querySelector(this.scrollingElementSelector) as HTMLElement;

    if (!element || !scrollingElement) {
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
      if (this.isDestroyed || !scrollingElement) {
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
  }
}
