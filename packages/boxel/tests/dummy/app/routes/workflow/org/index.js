import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class WorkflowOrgIndexRoute extends Route {
  @service router;

  async beforeModel(transition) {
    await super.beforeModel(transition);
    const { orgQueueCards } = this.modelFor('workflow.org');
    this.router.transitionTo('workflow.org.thread', orgQueueCards[0].id);
  }
}
