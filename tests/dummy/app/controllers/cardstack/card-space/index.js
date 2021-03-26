import CardstackController from '../../cardstack';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
export default class CardSpaceIndexController extends CardstackController {
  @service('cardstack-session') cardstackSession;

  @action
  transitionToSpace() {
    this.transitionToRoute('cardstack.card-space.new');
  }
}
