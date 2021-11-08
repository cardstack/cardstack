import Controller from '@ember/controller';
import { action } from '@ember/object';
import RouterService from '@ember/routing/router-service';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import TokenToUsd from '@cardstack/web-client/services/token-to-usd';
import { TokenBalance } from '@cardstack/web-client/utils/token';
import BN from 'bn.js';

export default class CardPayDepositAndWithdrawalController extends Controller {
  queryParams = ['flow', { workflowPersistenceId: 'flow-id' }];
  @tracked flow: string | null = null;
  @tracked workflowPersistenceId: string | null = null;
  @service declare router: RouterService;
  @service declare layer2Network: Layer2Network;
  @service declare tokenToUsd: TokenToUsd;

  @action transitionToDepositWithdrawal(flow: string) {
    this.router.transitionTo('card-pay.deposit-withdrawal', {
      queryParams: { flow },
    });
  }

  @action resetQueryParams() {
    this.flow = null;
    this.workflowPersistenceId = null;
  }

  get tokensToDisplay() {
    if (!this.layer2Network.isConnected) {
      return [];
    }
    return [
      new TokenBalance(
        this.layer2Network.bridgedDaiTokenSymbol,
        this.layer2Network.defaultTokenBalance ?? new BN('0')
      ),
      new TokenBalance(
        this.layer2Network.bridgedCardTokenSymbol,
        this.layer2Network.cardBalance ?? new BN('0')
      ),
    ].filter((el) => el.balance && !el.balance?.isZero());
  }

  get usdBalanceTotal() {
    return this.tokensToDisplay.reduce((sum, item) => {
      let usdBalance = this.tokenToUsd.toUsdFrom(item.symbol, item.balance);
      if (usdBalance) {
        return (sum += usdBalance);
      }
      return 0;
    }, 0);
  }
}
