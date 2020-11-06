import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { CardstackSession } from '../../../services/cardstack-session';
import RouterService from '@ember/routing/router-service';

export default class ViewCardController extends Controller {
  @service router!: RouterService;
  @service cardstackSession!: CardstackSession;

  get realmOrg() {
    if (!this.model.card) {
      return null;
    }

    let realmUrl = this.model.card.csRealm.split('/');
    let id = realmUrl[realmUrl.length - 1];
    let org = this.cardstackSession.userOrgs.find(el => el.id === id);

    return org;
  }
}
