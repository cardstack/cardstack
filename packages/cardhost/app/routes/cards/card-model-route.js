import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class CardModelRoute extends Route {
  @service data;
  @service cardstackSession;

  async model({ id }) {
    return await this.data.getCard(`local-hub::${id}`, 'isolated');
  }

  async afterModel(model, transition) {
    let viewOrEdit = transition.targetName.match(/cards.edit|cards.schema/)

    // If the user is not logged in, redirect to layout view.
    if (!this.cardstackSession.isAuthenticated && viewOrEdit) {
      this.transitionTo('cards.view', model.name);
    }
  }
}
