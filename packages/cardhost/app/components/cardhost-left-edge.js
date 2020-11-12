import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class CardhostLeftEdgeComponent extends Component {
  @service routeInfo;
  @service cardstackSession;
  @service library;
  @service router;
  @tracked isExpanded = false;

  get cardId() {
    if (!this.routeInfo.currentCard) {
      return null;
    }
    return this.routeInfo.currentCard.canonicalURL;
  }

  get currentRealmId() {
    if (!this.routeInfo.currentRealm) {
      return null;
    }
    return this.routeInfo.currentRealm.id;
  }

  @action
  toggleMenuExpand() {
    this.isExpanded = !this.isExpanded;
    this.router.transitionTo('cards.collection', 'default');
  }

  @action
  logout(sessionLogout) {
    sessionLogout.bind(this.cardstackSession)();
    this.library.hide();

    if (this.cardId) {
      this.router.transitionTo('cards.card.view', this.cardId);
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
