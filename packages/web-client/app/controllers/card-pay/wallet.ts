import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { action } from '@ember/object';
import RouterService from '@ember/routing/router-service';
import config from '@cardstack/web-client/config/environment';

class CardPayWalletController extends Controller {
  @service declare layer2Network: Layer2Network;
  @service declare router: RouterService;

  testFlightLink = config.urls.testFlightLink;
  queryParams = ['flow', { workflowPersistenceId: 'flow-id' }];
  @tracked flow: string | null = null;
  @tracked workflowPersistenceId: string | null = null;

  get prepaidCards() {
    return this.layer2Network.safes.value?.filterBy('type', 'prepaid-card');
  }

  @action transitionToWallet(flow: string) {
    this.router.transitionTo('card-pay.wallet', {
      queryParams: { flow },
    });
  }

  @action resetQueryParams() {
    this.flow = null;
    this.workflowPersistenceId = null;
  }
}

export default CardPayWalletController;
