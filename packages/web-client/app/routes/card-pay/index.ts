import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import RouterService from '@ember/routing/router-service';

export default class CardPayIndexRoute extends Route {
  @service declare router: RouterService;

  beforeModel(/* transition */) {
    this.router.transitionTo('card-pay.wallet');
  }
}
