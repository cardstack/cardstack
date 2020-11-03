import Route from '@ember/routing/route';
import { Org } from '../../services/cardstack-session';

interface Model {
  org: Org;
}

export default class CardsIndexRoute extends Route {
  async afterModel(model: Model) {
    if (!model) {
      return;
    }
    let collectionId = model.org.collections[0];
    this.transitionTo('cards.collection', model.org.id, collectionId);
  }
}
