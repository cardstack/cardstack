import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class OverlaysService extends Service {
  @tracked showLoading = false;
  @tracked loadingText = 'Generating Card';

  /*
   * Set overlay state only through this method so that it's easy
   * to debug state changes, which could come from anywhere in the app.
   */
  @action
  setOverlayState(propertyName, val) {
    this[propertyName] = val;
  }

  @action
  reset() {
    this.showLoading = false;
    // if other booleans are tracked in this service in the future,
    // add them here.
  }
}
