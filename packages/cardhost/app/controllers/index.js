import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
export default class IndexController extends Controller {
  @service router;

  @action
  updateCard(id) {
    this.router.transitionTo('cards.update', id);
  }
}