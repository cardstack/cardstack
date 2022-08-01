import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class WorkflowIndexRoute extends Route {
  @service router;

  async beforeModel(transition) {
    await super.beforeModel(transition);
    const { userOrgs } = this.modelFor('workflow');
    this.router.transitionTo('workflow.org', userOrgs[0].id);
  }
}
