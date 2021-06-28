import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import Component from '@glimmer/component';
import { ref } from 'ember-ref-bucket';

let LOCK_THRESHOLD = 40;

interface ThreadMessageComponentArgs {
  autoscroll: boolean;
}

export default class ThreadMessageComponent extends Component<ThreadMessageComponentArgs> {
  @ref('threadRoot') declare threadRoot: HTMLElement;
  @tracked watchedElement: HTMLElement | null = null;
  @tracked scrollEl: HTMLElement | null = null;
  @tracked showFooter = false;

  @action setWatchedElement(element: HTMLElement): void {
    this.watchedElement = element;
  }

  @action setScrollEl(element: HTMLElement): void {
    this.scrollEl = element;
  }

  @action onElementVisible(): void {
    console.log('last element visible');
    this.showFooter = false;
  }
  @action onElementHidden(): void {
    console.log('last element hidden');
    this.showFooter = true;
  }

  @action scrollDownToFirst(elements: HTMLElement[]): void {
    if (!this.args.autoscroll) return;
    let element = elements[0];
    if (element) {
      let elementBounds = element.getBoundingClientRect();
      let scrollBounds = this.scrollEl?.getBoundingClientRect() || {
        bottom: -Infinity,
      };

      let diff = elementBounds.top - scrollBounds.bottom;

      if (diff < LOCK_THRESHOLD && diff >= -LOCK_THRESHOLD) {
        this.scrollEl?.scrollTo({
          top: element.offsetTop,
          left: 0,
          behavior: 'smooth',
        });
      }
    }
  }
}
