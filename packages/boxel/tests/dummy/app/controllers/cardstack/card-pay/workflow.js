import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class CardPayWorkflowController extends Controller {
  @tracked expanded = false;

  @action
  toggleExpand() {
    this.expanded = !this.expanded;
  }

  @action
  transitionToDashboard() {
    this.transitionToRoute('cardstack.card-pay');
  }
}
