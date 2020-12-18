import Route from '@ember/routing/route';

export default class WorkflowOrgRoute extends Route {
  async model({ orgId }) {
    const { user, userOrgs, queueCards } = this.modelFor('workflow');
    let currentOrg = userOrgs.find(el => el.id === orgId);
    let orgQueueCards = queueCards.filter(el => el.orgId === orgId);

    return {
      user,
      userOrgs,
      currentOrg,
      orgQueueCards
    };
  }
}
