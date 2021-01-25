import Controller from '@ember/controller';
import { action } from '@ember/object';

export default class CardPayWorkflowController extends Controller {
  @action
  transitionToDashboard() {
    this.transitionToRoute('card-pay');
  }
}
