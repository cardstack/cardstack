import Route from '@ember/routing/route';
import { fetchData } from 'dummy/data-workflow';

const USER_ID = 'haley-oconnell';
const ORG_ID = 'hsh';

export default class WorkflowRoute extends Route {
  userId = USER_ID;
  orgId = ORG_ID;

  async model() {
    if (!this.userId) { return; }

    const users = await fetchData('e-commerce-participants');
    const userOrgs = await fetchData('e-commerce-orgs');

    let user = users.find(el => el.id === this.userId);
    let orgs = userOrgs.filter(el => user.org_ids.includes(el.id));
    let currentOrg = orgs.find(el => el.id === this.orgId);

    return {
      user,
      orgs,
      currentOrg
    }
  }
}
