import Controller from '@ember/controller';
import { action } from '@ember/object';

export default class CardsAddController extends Controller {
  @action
  closeDialog() {
    this.transitionToRoute('cards.card.configure.fields', this.model.card.canonicalURL);
  }
}
