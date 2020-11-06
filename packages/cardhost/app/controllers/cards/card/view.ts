import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import RouteInfoService from '../../../services/route-info';

export default class ViewCardController extends Controller {
  @service routeInfo!: RouteInfoService;

  get realmOrg() {
    if (!this.routeInfo.currentRealm) {
      return null;
    }

    return this.routeInfo.currentRealm;
  }
}
