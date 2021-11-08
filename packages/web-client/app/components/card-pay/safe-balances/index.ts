import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { Safe } from '@cardstack/cardpay-sdk';
import { TokenBalance, TokenSymbol } from '@cardstack/web-client/utils/token';
import TokenToUsd from '@cardstack/web-client/services/token-to-usd';
import BN from 'bn.js';

interface CardPaySafeBalancesComponentArgs {
  safe: Safe;
}

export default class CardPaySafeBalancesComponent extends Component<CardPaySafeBalancesComponentArgs> {
  @service declare tokenToUsd: TokenToUsd;

  get tokenBalances() {
    return this.args.safe.tokens.map(
      (token) =>
        new TokenBalance(
          token.token.symbol as TokenSymbol,
          new BN(token.balance)
        )
    );
  }

  get usdBalanceTotal() {
    return this.tokenBalances.reduce((sum, item) => {
      let usdBalance = this.tokenToUsd.toUsdFrom(item.symbol, item.balance);
      if (usdBalance) {
        return (sum += usdBalance);
      }
      return 0;
    }, 0);
  }
}
