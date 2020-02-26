import Controller from '@ember/controller';
import { inject as service } from '@ember/service';

export default class CardsController extends Controller {
  @service cssModeToggle;
  @service cardstackSession;
  @service routeInfo;
  @service draggable;
  @service library;

  get currentCard() {
    let card;
    let route = this.target.currentRoute;
    while (route) {
      card = route.attributes && route.attributes.card;
      if (!card) {
        route = route.parent;
      } else {
        break;
      }
    }
    return card;
  }

  get themerClasses() {
    if (this.hasThemerTools) {
      return `editing-css themer-card-width--${this.cssModeToggle.width}`; // width is small, medium, or large
    } else {
      return '';
    }
  }

  get hasThemerTools() {
    return this.routeInfo.mode === 'themer' || this.routeInfo.mode === 'layout';
  }
}
