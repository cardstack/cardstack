import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

import Layer2Network from '@cardstack/web-client/services/layer2-network';

class IndexController extends Controller {
  @service declare layer2Network: Layer2Network;
  queryParams = [
    {
      cardSpaceId: 'card-space-id',
    },
  ];

  @action connectToWallet() {
    console.log('Connect to wallet here');
  }

  get isHorizontal() {
    return window.innerWidth < 560;
  }
}

export default IndexController;
