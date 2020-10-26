import ViewCardController from '../view';
import { action } from '@ember/object';

export default class EditCardController extends ViewCardController {
  @action
  closeDialog() {
    this.transitionToRoute('cards.card.view', this.model.card.canonicalURL);
  }
}
