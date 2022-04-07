import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import CardSpaceService from '@cardstack/ssr-web/services/card-space';

export default class NotFoundRoute extends Route {
  @service('card-space') declare cardSpace: CardSpaceService;

  beforeModel() {
    if (this.cardSpace.isActive) {
      this.transitionTo('index');
    } else {
      throw new Error('404: Not Found');
    }
  }
}
