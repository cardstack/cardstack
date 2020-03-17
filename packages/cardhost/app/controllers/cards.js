import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import ENV from '@cardstack/cardhost/config/environment';

const { animationSpeed } = ENV;
const duration = animationSpeed || 500;

export default class CardsController extends Controller {
  @service cssModeToggle;
  @service cardstackSession;
  @service routeInfo;
  @service draggable;
  @service library;

  duration = duration;

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
    return this.routeInfo.mode === 'themer' || this.routeInfo.mode === 'layout' || this.routeInfo.mode === 'preview';
  }

  get hideTopEdge() {
    return this.routeInfo.mode === 'cards' || this.routeInfo.mode === 'view';
  }
}
