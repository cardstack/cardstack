import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
export default class CardsIndexController extends Controller {
  @service router;

  @action
  viewCard(id) {
    this.router.transitionTo('cards.card.view', id);
  }
}
