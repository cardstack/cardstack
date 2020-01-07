import Controller from '@ember/controller';
import { inject as service } from '@ember/service';

export default class CardsController extends Controller {
  @service cssModeToggle;
  @service cardstackSession;
  @service router;

  get themerClasses() {
    let onThemerRoute = this.router.currentRouteName.includes('themer');
    if (onThemerRoute && this.cssModeToggle.isResponsive) {
      return 'responsive editing-css';
    } else if (onThemerRoute && !this.cssModeToggle.isResponsive) {
      return 'full-width editing-css';
    } else {
      return '';
    }
  }

  get onThemerRoute() {
    return this.router.currentRouteName.includes('themer');
  }
}
