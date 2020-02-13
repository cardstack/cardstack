import Route from '@ember/routing/route';
import { Card } from '@cardstack/core/card';

export default class CardsCardEditIndexRoute extends Route {
  afterModel(model: Card) {
    this.transitionTo('cards.card.edit.fields', model);
  }
}
