import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import Layer2Network from '@cardstack/web-client/services/layer2-network';

class CardPayBalancesController extends Controller {
  @service declare layer2Network: Layer2Network;
}

export default CardPayBalancesController;
