import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import RouterService from '@ember/routing/router-service';
import CardSpaceService from '@cardstack/ssr-web/services/card-space';
import '../css/wc.css';
export default class WcRoute extends Route {
  @service declare router: RouterService;
  @service('card-space') declare cardSpace: CardSpaceService;

  beforeModel() {
    if (this.cardSpace.isActive) {
      this.router.transitionTo('index');
    }
  }
}
