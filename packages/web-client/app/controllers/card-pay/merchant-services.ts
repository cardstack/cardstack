import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import Layer2Network from '@cardstack/web-client/services/layer2-network';

export default class CardPayMerchantServicesController extends Controller {
  @service declare layer2Network: Layer2Network;

  queryParams = ['flow'];
  @tracked flow: 'create-merchant' | null = null;

  get merchantSafes() {
    return this.layer2Network.safes.value?.filterBy('type', 'merchant');
  }
}
