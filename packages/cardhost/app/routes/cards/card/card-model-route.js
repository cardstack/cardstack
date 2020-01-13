import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class CardModelRoute extends Route {
  @service cardstackSession;

  afterModel(model, transition) {
    let viewOrEdit = transition.targetName.match(/cards.card.edit|cards.card.schema/);

    // If the user is not logged in, redirect to card index.
    if (!this.cardstackSession.isAuthenticated && viewOrEdit) {
      this.transitionTo('cards.card', model);
    }
  }
}
