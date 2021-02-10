import Route from '@ember/routing/route';
// NOTE: This import should eventually be replaced by fetch to
// mirage data
import dbWorkflow from 'dummy/data/db-workflow';
import 'dummy/css/templates/workflow.css';

const USER_ID = 'haley-oconnell';

export default class WorkflowRoute extends Route {
  userId = USER_ID;

  async model() {
    let { users, orgs, queueCards, messages, workflows } = dbWorkflow;

    let user = users.find((el) => el.id === this.userId);
    let userOrgs = orgs.filter((el) => user.org_ids.includes(el.id));

    return {
      user,
      users,
      userOrgs,
      queueCards,
      messages,
      workflows,
    };
  }
}
