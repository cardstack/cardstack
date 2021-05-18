import Helper from '@ember/component/helper';
import BN from 'bn.js';
import { inject as service } from '@ember/service';
import TokenToUsd from '@cardstack/web-client/services/token-to-usd';
import {
  convertibleSymbols,
  ConvertibleSymbol,
} from '@cardstack/web-client/utils/web3-strategies/token-categories';

type TokenToUsdHelperParams = [ConvertibleSymbol, BN];

// This helper uses the `TokenToUsd` service to convert a given token
// amount in wei to USD (to the penny). Supported tokens are CARD & DAI
class TokenToUsdHelper extends Helper {
  @service('token-to-usd') declare tokenToUsdService: TokenToUsd;

  // `symbol` and `amount` properties are set by compute to allow the TokenToUsd
  // service to figure out which conversion functions are needed by the app
  // at any given time. This allows the service to efficiently fetch just
  // the conversions we need from our oracles.
  symbol: ConvertibleSymbol | undefined;
  amount: BN | undefined;

  compute([symbol, amount]: TokenToUsdHelperParams) {
    if (!convertibleSymbols.includes(symbol)) {
      throw new Error(`Invalid symbol ${symbol} passed to {{token-to-usd}}`);
    }
    if (amount === null || amount === undefined) {
      return '';
    }
    this.symbol = symbol;
    this.amount = amount;
    this.tokenToUsdService.register(this);
    return this.tokenToUsdService.toUsdFrom(symbol, amount);
  }

  willDestroy() {
    this.tokenToUsdService.unregister(this);
  }
}

export default TokenToUsdHelper;
