import Route from '@ember/routing/route';
import { USER_ORGS } from '../../services/cardstack-session';

export default class CardsIndexRoute extends Route {
  beforeModel() {
    let { id, collection } = USER_ORGS[0];
    this.transitionTo('cards.collection.view', id, collection);
  }
}
