import Controller from '@ember/controller';
import { action } from '@ember/object';
import RouterService from '@ember/routing/router-service';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import {
  TokenDisplayInfo,
  TokenSymbol,
} from '@cardstack/web-client/utils/token';
import BN from 'bn.js';

export default class CardPayTokenSuppliersController extends Controller {
  queryParams = ['flow', { workflowPersistenceId: 'flow-id' }];
  @tracked flow: string | null = null;
  @tracked workflowPersistenceId: string | null = null;
  @service declare router: RouterService;
  @service declare layer2Network: Layer2Network;

  @action transitionToTokenSuppliers(flow: string) {
    this.router.transitionTo('card-pay.token-suppliers', {
      queryParams: { flow },
    });
  }

  @action resetQueryParams() {
    this.flow = null;
    this.workflowPersistenceId = null;
  }

  get tokens() {
    if (!this.layer2Network.isConnected) {
      return undefined;
    }
    return this.layer2Network.depotSafe?.tokens;
  }

  get tokensWithDisplayInfo() {
    return this.tokens?.map((item) => {
      let symbol =
        item.token.symbol === 'DAI' || item.token.symbol === 'CARD'
          ? `${item.token.symbol}.CPXD`
          : item.token.symbol;
      let displayInfo = new TokenDisplayInfo(symbol as TokenSymbol);

      return {
        balance: new BN(item.balance),
        symbol,
        icon: displayInfo.icon,
      };
    });
  }
}
