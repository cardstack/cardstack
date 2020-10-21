import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { CardstackSession } from '../../../services/cardstack-session';
import { Card } from '@cardstack/hub';

export default class CardModelRoute extends Route {
  @service cardstackSession!: CardstackSession;

  afterModel(model: Card, transition: any) {
    let editMode = transition.targetName.match(/cards.card.view.edit/);
    let viewMode = transition.targetName.match(/cards.card.view/);

    // If the user is not logged in, redirect to card index.
    if ((!this.cardstackSession.isAuthenticated && editMode) || (!this.cardstackSession.isAuthenticated && !viewMode)) {
      this.transitionTo('cards.card.view', model);
    }
  }
}
