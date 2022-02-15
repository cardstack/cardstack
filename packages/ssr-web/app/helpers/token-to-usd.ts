import Helper from '@ember/component/helper';
import BN from 'bn.js';
import { inject as service } from '@ember/service';
import TokenToUsd, {
  UsdConvertibleSymbol,
} from '@cardstack/ssr-web/services/token-to-usd';
import { TokenSymbol } from '@cardstack/ssr-web/utils/token';

type TokenToUsdHelperParams = [TokenSymbol, BN];

// This helper uses the `TokenToUsd` service to convert a given token
// amount in wei to USD (to the penny). Supported tokens are listed here:
let usdConvertibleSymbols = ['CARD.CPXD', 'DAI.CPXD', 'ETH'];

class TokenToUsdHelper extends Helper {
  @service('token-to-usd') declare tokenToUsdService: TokenToUsd;

  // `symbol` and `amount` properties are set by compute to allow the TokenToUsd
  // service to figure out which conversion functions are needed by the app
  // at any given time. This allows the service to efficiently fetch just
  // the conversions we need from our oracles.
  symbol: UsdConvertibleSymbol | undefined;
  amount: BN | undefined;

  compute([symbol, amount]: TokenToUsdHelperParams): number | undefined {
    switch (symbol) {
      case 'CARD':
        symbol = 'CARD.CPXD';
        break;
      case 'DAI':
        symbol = 'DAI.CPXD';
        break;
    }
    if (!usdConvertibleSymbols.includes(symbol)) {
      throw new Error(`Invalid symbol ${symbol} passed to {{token-to-usd}}`);
    }
    if (amount === null || amount === undefined) {
      return undefined;
    }
    this.symbol = symbol;
    this.amount = amount;
    if (amount?.gt(new BN(0))) {
      this.tokenToUsdService.register(this);
      return this.tokenToUsdService.toUsdFrom(symbol, amount);
    } else {
      return 0;
    }
  }

  willDestroy() {
    this.tokenToUsdService.unregister(this);
  }
}

export default TokenToUsdHelper;
