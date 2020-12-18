import Route from '@ember/routing/route';
import { fetchData } from '@cardstack/boxel/data-workflow';

const USER_ID = 'haley-oconnell';

export default class WorkflowRoute extends Route {
  userId = USER_ID;

  async model() {
    let db = await fetchData('db-workflow');
    let { users, orgs, queueCards, messages, workflows } = db;

    let user = users.find(el => el.id === this.userId);
    let userOrgs = orgs.filter(el => user.org_ids.includes(el.id));

    return {
      user,
      users,
      userOrgs,
      queueCards,
      messages,
      workflows
    };
  }
}
