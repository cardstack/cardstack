import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class CardhostTopEdgeComponent extends Component {
  @service router;

  @action
  logout(sessionLogout) {
    sessionLogout();
    let cardId = this.router.currentRoute.params.id;
    if (cardId) {
      this.router.transitionTo('cards.view', cardId);
    } else {
      this.router.transitionTo('index');
    }
  }
}
