import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import ENV from '@cardstack/cardhost/config/environment';

const { useMockLogin } = ENV;

export default class CardhostLeftEdgeComponent extends Component {
  @service cardstackSession;
  @service library;
  @tracked isExpanded = false;

  useMockLogin = useMockLogin;

  @action
  toggleMenuExpand() {
    this.isExpanded = !this.isExpanded;
  }

  @service router;

  @action
  logout(sessionLogout) {
    sessionLogout();
    this.library.hide();
    let cardId = this.router.currentRoute.parent.params.name;
    if (cardId) {
      this.router.transitionTo('cards.card.view', cardId);
    } else {
      this.router.transitionTo('index');
    }
  }

  @action
  closeLeftEdge() {
    this.isExpanded = false;
  }

  @action
  showLibrary() {
    this.isLibraryOpen = true;
  }

  @action
  hideLibrary() {
    this.isLibraryOpen = false;
  }
}
