import Controller from '@ember/controller';
import { inject as service } from '@ember/service';

export default class CardsController extends Controller {
  @service cssModeToggle;
  @service cardstackSession;
  @service router;
  @service routeInfo;
  @service draggable;
  @service library;

  get mode() {
    return this.routeInfo.mode || 'view';
  }

  get themerClasses() {
    if (this.hasThemerTools) {
      return `editing-css themer-card-width--${this.cssModeToggle.width}`; // width is small, medium, or large
    } else {
      return '';
    }
  }

  get hasThemerTools() {
    return this.mode === 'themer' || this.mode === 'layout' || this.mode === 'preview';
  }

  get hideTopEdge() {
    return this.mode === 'cards' || this.mode === 'view';
  }

  get hideLeftEdge() {
    return this.mode === 'preview';
  }
}
