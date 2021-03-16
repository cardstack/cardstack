import CardstackController from '../../cardstack';
import { action } from '@ember/object';

export default class CardSpaceIndexController extends CardstackController {
  @action
  transitionToSpace() {
    this.transitionToRoute('cardstack.card-space.new');
  }
}
