import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class CardhostLeftEdgeComponent extends Component {
  @service cardstackSession;
  @tracked isExpanded = false;
  @tracked isLibraryOpen = false;

  @action
  toggleMenuExpand() {
    this.isExpanded = !this.isExpanded;
  }

  @service router;

  @action
  logout(sessionLogout) {
    sessionLogout();
    this.hideLibrary();
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
