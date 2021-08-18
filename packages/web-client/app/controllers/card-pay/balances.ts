import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import Layer2Network from '@cardstack/web-client/services/layer2-network';

class CardPayBalancesController extends Controller {
  @service declare layer2Network: Layer2Network;

  queryParams = ['flow'];
  @tracked flow: 'deposit' | null = null;

  get prepaidCards() {
    return this.layer2Network.safes.value?.filterBy('type', 'prepaid-card');
  }
}

export default CardPayBalancesController;
