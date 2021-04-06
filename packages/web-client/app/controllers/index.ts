import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { Registry as Services } from '@ember/service';
import { action } from '@ember/object';

import Layer2Network from '@cardstack/web-client/services/layer2-network';

class IndexController extends Controller {
  @service router!: Services['router'];
  @service declare layer2Network: Layer2Network;

  @action transitionTo(routeName: string) {
    this.router.transitionTo(routeName);
  }

  @action connectToWallet() {
    console.log('Connect to wallet here');
  }
}

export default IndexController;
