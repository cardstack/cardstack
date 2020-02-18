import { Card } from '@cardstack/core/card';
import CardModelRoute from '../card-model-route';

export default class CardsCardEditIndexRoute extends CardModelRoute {
  afterModel(model: Card) {
    this.transitionTo('cards.card.edit.fields', model);
  }
}
