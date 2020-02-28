import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class CardhostLeftEdgeComponent extends Component {
  @service cardstackSession;
  @service library;
  @service router;
  @tracked isExpanded = false;

  @action
  toggleMenuExpand() {
    this.isExpanded = !this.isExpanded;
  }

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
  transitionToSchema() {
    let cardId = this.router.currentRoute.parent.params.name || this.router.currentRoute.parent.attributes.name;
    if (cardId) {
      this.router.transitionTo('cards.card.edit.fields.schema', cardId);
    }
  }
}
