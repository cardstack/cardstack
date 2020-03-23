import { Card } from '@cardstack/hub';
import CardModelRoute from '../card-model-route';

export default class CardsCardEditIndexRoute extends CardModelRoute {
  afterModel(model: Card) {
    this.transitionTo('cards.card.edit.fields', model);
  }
}
