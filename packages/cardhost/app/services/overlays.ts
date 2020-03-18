import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

type OverlayState = 'showLoading' | 'loadingText';

export default class OverlaysService extends Service {
  @tracked showLoading = false;
  @tracked loadingText = 'Generating Card';

  /*
   * Set overlay state only through this method so that it's easy
   * to debug state changes, which could come from anywhere in the app.
   */
  setOverlayState(propertyName: 'showLoading', val: boolean): void;
  setOverlayState(propertyName: 'loadingText', val: string): void;
  @action
  setOverlayState(propertyName: OverlayState, val: string | boolean): void {
    if (propertyName === 'showLoading' && typeof val === 'boolean') {
      this.showLoading = val;
    } else if (propertyName === 'loadingText' && typeof val === 'string') {
      this.loadingText = val;
    }
  }

  @action
  reset() {
    this.showLoading = false;
    // if other booleans are tracked in this service in the future,
    // add them here.
  }
}
