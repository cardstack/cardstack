import Controller from '@ember/controller';
import { inject as service } from '@ember/service';

export default class CardsController extends Controller {
  @service cssModeToggle;
  @service cardstackSession;
  @service router;
  @service routeInfo;
  @service draggable;

  get themerClasses() {
    if (this.onThemerRoute) {
      return `editing-css themer-card-width--${this.cssModeToggle.width}`; // width is small, medium, or large
    } else {
      return '';
    }
  }

  get onThemerRoute() {
    return this.router.currentRoute.localName === 'themer';
  }
}
