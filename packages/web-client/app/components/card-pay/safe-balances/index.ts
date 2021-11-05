import Component from '@glimmer/component';
import { Safe } from '@cardstack/cardpay-sdk';
import { TokenBalance, TokenSymbol } from '@cardstack/web-client/utils/token';
import BN from 'bn.js';

interface CardPaySafeBalancesComponentArgs {
  safe: Safe;
}

export default class CardPaySafeBalancesComponent extends Component<CardPaySafeBalancesComponentArgs> {
  get tokenBalances() {
    return this.args.safe.tokens.map(
      (token) =>
        new TokenBalance(
          token.token.symbol as TokenSymbol,
          new BN(token.balance)
        )
    );
  }
}
