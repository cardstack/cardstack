import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class CardModelRoute extends Route {
  @service cardstackSession;

  afterModel(model, transition) {
    let editMode = transition.targetName.match(/cards.card.edit/);

    // If the user is not logged in, redirect to card index.
    if (!this.cardstackSession.isAuthenticated && editMode) {
      this.transitionTo('cards.card', model);
    }
  }
}
