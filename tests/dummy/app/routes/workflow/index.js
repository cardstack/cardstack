import Route from '@ember/routing/route';

export default class WorkflowIndexRoute extends Route {
  async beforeModel(transition) {
    await super.beforeModel(transition);
    const { userOrgs } = this.modelFor('workflow');
    this.transitionTo('workflow.org', userOrgs[0].id);
  }
}
