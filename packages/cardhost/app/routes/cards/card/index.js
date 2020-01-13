import Route from '@ember/routing/route';

export default class CardsCardIndexRoute extends Route {
  afterModel(model /*, transition*/) {
    if (model) {
      this.transitionTo('cards.card.view', model);
    }
  }
}
