import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class EditCardController extends Controller {
  @service routeInfo;

  @action
  leaveEditMode() {
    this.transitionToRoute('cards.card.view', this.model);
  }
}
