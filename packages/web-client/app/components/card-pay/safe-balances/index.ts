import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { DepotSafe, MerchantSafe, Safe } from '@cardstack/cardpay-sdk';
import { TokenBalance, TokenSymbol } from '@cardstack/web-client/utils/token';
import TokenToUsd from '@cardstack/web-client/services/token-to-usd';
import BN from 'bn.js';

interface CardPaySafeBalancesComponentArgs {
  safe: Safe;
}

type SupportedSafe = DepotSafe | MerchantSafe;

export default class CardPaySafeBalancesComponent extends Component<CardPaySafeBalancesComponentArgs> {
  @service declare tokenToUsd: TokenToUsd;

  constructor(owner: unknown, args: CardPaySafeBalancesComponentArgs) {
    super(owner, args);

    if (!isSupportedSafe(args.safe)) {
      throw new Error(
        `CardPay::SafeBalances does not support a safe type of ${args.safe.type}`
      );
    }
  }

  get safeType() {
    let safe = this.args.safe as SupportedSafe;
    return {
      depot: 'Depot',
      merchant: 'Business',
    }[safe.type];
  }

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

export function isSupportedSafe(safe: Safe): safe is SupportedSafe {
  // FIXME how can I use the types here?
  return ['depot', 'merchant'].includes(safe.type);
}
