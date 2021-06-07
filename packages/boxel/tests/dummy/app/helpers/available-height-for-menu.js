import Helper from '@ember/component/helper';
import { action } from '@ember/object';

export default class AvailableHeightForMenuHelper extends Helper {
  constructor() {
    super(...arguments);
    window.addEventListener('resize', this.boundRecompute);
    window.addEventListener('orientationchange', this.boundRecompute);
  }

  willDestroy() {
    window.removeEventListener('resize', this.boundRecompute);
    window.removeEventListener('orientationchange', this.boundRecompute);
  }

  compute([dropdown] /*, hash*/) {
    let triggerEl = document.querySelector(
      `[data-ebd-id="${dropdown.uniqueId}-trigger"]`
    );
    if (triggerEl) {
      let triggerBottom = triggerEl.getBoundingClientRect().bottom;
      let viewportHeight = document.body.clientHeight;
      let maxHeight = viewportHeight - triggerBottom;
      return maxHeight;
    }
    return null;
  }

  @action
  boundRecompute() {
    this.recompute();
  }
}
