import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class CardhostLeftEdgeComponent extends Component {
  @service cardstackSession;
  @service library;
  @service router;
  @tracked isExpanded = false;

  get cardId() {
    let cardId;
    let route = this.router.currentRoute;
    while (route) {
      cardId = route.params.id;
      if (!cardId) {
        route = route.parent;
      } else {
        break;
      }
    }
    return cardId;
  }

  @action
  toggleMenuExpand() {
    this.isExpanded = !this.isExpanded;
  }

  @action
  logout(sessionLogout) {
    sessionLogout.bind(this.cardstackSession)();
    this.library.hide();

    if (this.cardId) {
      this.router.transitionTo('cards.card.view', this.cardId);
    } else {
      this.router.transitionTo('index');
    }
  }

  @action
  login(sessionLogin, username) {
    sessionLogin.bind(this.cardstackSession)(username);
  }

  @action
  closeLeftEdge() {
    this.isExpanded = false;
  }
}
