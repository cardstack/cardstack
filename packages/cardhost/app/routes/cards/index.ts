import Route from '@ember/routing/route';

export default class CardsIndexRoute extends Route {
  beforeModel() {
    this.transitionTo('cards.collection');
  }
}
