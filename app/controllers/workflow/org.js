import Controller from '@ember/controller';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class WorkflowOrgController extends Controller {
  @tracked currentCard = this.model.orgQueueCards[0];

  @action
  selectCard(card) {
    this.currentCard = card;
    this.transitionToRoute('workflow.org.thread', card.id);
  }
}
