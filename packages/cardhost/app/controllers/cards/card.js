import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class CardsCardController extends Controller {
  @tracked attemptedLeaveTransition;

  @action proceed() {
    this.overrideSaveWarning = true;
    this.attemptedLeaveTransition.retry();
  }

  @action stay() {
    this.attemptedLeaveTransition = null;
  }
}
