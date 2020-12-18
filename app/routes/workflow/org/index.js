import Route from '@ember/routing/route';

export default class WorkflowOrgIndexRoute extends Route {
  async beforeModel(transition) {
    await super.beforeModel(transition);
    const { orgQueueCards } = this.modelFor('workflow.org');
    this.transitionTo('workflow.org.thread', orgQueueCards[0].id);
  }
}
