import Route from '@ember/routing/route';
import dbWorkflow from '@cardstack/boxel/data/db-workflow';

export default class WorkflowOrgRoute extends Route {
  async model({ orgId }) {
    const { user, userOrgs, queueCards } = this.modelFor('workflow');
    let currentOrg = userOrgs.find((el) => el.id === orgId);
    let orgQueueCards = queueCards.filter((el) => el.orgId === orgId);
    for (let card of orgQueueCards) {
      card.participants = (card.participant_ids ?? []).map((pid) =>
        dbWorkflow.users.find((u) => u.id === pid)
      );
    }

    return {
      user,
      userOrgs,
      currentOrg,
      orgQueueCards,
    };
  }
}
