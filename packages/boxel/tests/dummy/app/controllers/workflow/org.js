import Controller from '@ember/controller';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';

export default class WorkflowOrgController extends Controller {
  @service router;
  @tracked currentCard = this.model.orgQueueCards[0];

  @action
  selectCard(card) {
    this.currentCard = card;
    this.router.transitionTo('workflow.org.thread', card.id);
  }

  @action goHome() {
    this.router.transitionTo('workflow');
  }

  @action transitionTo(orgId) {
    this.router.transitionTo('workflow.org', orgId);
  }
}
