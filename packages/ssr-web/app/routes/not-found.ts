import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import CardSpaceService from '@cardstack/ssr-web/services/card-space';
import RouterService from '@ember/routing/router-service';

export default class NotFoundRoute extends Route {
  @service declare router: RouterService;
  @service('card-space') declare cardSpace: CardSpaceService;

  beforeModel() {
    if (this.cardSpace.isActive) {
      this.router.transitionTo('index');
    } else {
      throw new Error('404: Not Found');
    }
  }
}
