import Route from '@ember/routing/route';
import { Card } from '@cardstack/core/card';

export default class CardsCardV2EditIndexRoute extends Route {
  afterModel(model: Card) {
    this.transitionTo('cards.card-v2.edit.fields', model);
  }
}
