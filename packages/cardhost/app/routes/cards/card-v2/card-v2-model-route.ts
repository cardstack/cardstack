import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { CardstackSession } from '../../../services/cardstack-session';
// import { Card } from '@cardstack/core/card';

export default class CardV2ModelRoute extends Route {
  @service cardstackSession!: CardstackSession;

  /* TODO after we get session working
  afterModel(model: Card, transition: any) {
    let editMode = transition.targetName.match(/cards.card.edit/);

    // If the user is not logged in, redirect to card index.
    if (!this.cardstackSession.isAuthenticated && editMode) {
      this.transitionTo('cards.card-v2', model);
    }
  }
  */
}
