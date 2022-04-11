import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import CardSpaceService from '@cardstack/ssr-web/services/card-space';
import '../css/wc.css';
export default class WcRoute extends Route {
  @service('card-space') declare cardSpace: CardSpaceService;

  beforeModel() {
    if (this.cardSpace.isActive) {
      this.transitionTo('index');
    }
  }
}
