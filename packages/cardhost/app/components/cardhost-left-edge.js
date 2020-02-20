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
    sessionLogout.bind(this.cardstackSession)();
    this.hideLibrary();

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
    if (cardId) {
      this.router.transitionTo('cards.card.view', cardId);
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

  /*
    closeListener, registerCloseListener, and destroyCloseListener are the
    actions responsible for closing the left edge when you click somewhere
    outside of it. They are only registered when the left edge is open,
    and torn down when it is closed via the did-insert and will-destroy
    render modifiers.
  */
  @action
  closeListener(event) {
    let thisElement = document.querySelector('#cardhost-left-edge');
    if (thisElement && !thisElement.contains(event.target)) {
      this.closeLeftEdge();
    }
  }

  @action
  registerCloseListener() {
    document.querySelector('body').addEventListener('click', this.closeListener);
    document.querySelector('body').addEventListener('focusin', this.closeListener);
  }

  @action
  destroyCloseListener() {
    document.querySelector('body').removeEventListener('click', this.closeListener);
    document.querySelector('body').removeEventListener('focusin', this.closeListener);
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
