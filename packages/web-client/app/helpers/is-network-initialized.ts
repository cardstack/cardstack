import Helper from '@ember/component/helper';
import { inject as service } from '@ember/service';
import Layer1Network from '../services/layer1-network';
import Layer2Network from '../services/layer2-network';

export default class IsNetworkInitializedHelper extends Helper {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;

  compute() {
    return !this.layer1Network.isInitializing;
  }
}
