import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
export default class CardsIndexController extends Controller {
  @service routeInfo;

  @action
  updateCard(card, isDirty) {
    this.send('updateCardModel', card, isDirty);
  }
}
