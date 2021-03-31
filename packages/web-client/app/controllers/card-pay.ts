import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import Layer2Network from '@cardstack/web-client/services/layer2-network';

export default class CardPayController extends Controller {
  @service declare layer2Network: Layer2Network;

  @action transitionToConnect() {
    this.transitionToRoute('card-pay.connect');
  }
  @action transitionTo(routeName: string) {
    this.transitionToRoute(routeName);
  }
}
