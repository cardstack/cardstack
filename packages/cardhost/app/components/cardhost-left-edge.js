import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class CardhostTopEdgeComponent extends Component {
  @service cardstackSession;
  @tracked isExpanded = false;

  @action
  toggleMenuExpand() {
    this.isExpanded = !this.isExpanded;
  }

  @service router;

  @action
  logout(sessionLogout) {
    sessionLogout();
    let cardId = this.router.currentRoute.parent.params.name;
    if (cardId) {
      this.router.transitionTo('cards.card.view', cardId);
    } else {
      this.router.transitionTo('index');
    }
  }
}
