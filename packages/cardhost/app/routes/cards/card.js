import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class CardsCardRoute extends Route {
  @service data;

  async model({ name }) {
    return await this.data.getCard(`local-hub::${name}`, 'isolated');
  }

  @action
  willTransition(transition) {
    let card = this.modelFor('cards.card'),
      controller = this.controllerFor('cards.card');

    if (card.isDirty && !controller.overrideSaveWarning) {
      transition.abort();
      controller.attemptedLeaveTransition = transition;
      return;
    }

    controller.attemptedLeaveTransition = null;
    controller.overrideSaveWarning = null;
  }
}
