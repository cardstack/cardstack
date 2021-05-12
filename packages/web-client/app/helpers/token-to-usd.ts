import Helper from '@ember/component/helper';
import BN from 'bn.js';
import { inject as service } from '@ember/service';
import TokenToUsd from '@cardstack/web-client/services/token-to-usd';
import { ConvertibleSymbol } from '../utils/web3-strategies/types';

type TokenToUsdHelperParams = [ConvertibleSymbol, BN];
const VALID_SYMBOLS = ['CARD', 'DAI'] as ConvertibleSymbol[];
class TokenToUsdHelper extends Helper {
  @service('token-to-usd') declare tokenToUsdService: TokenToUsd;
  symbol: ConvertibleSymbol | undefined;
  amount: BN | undefined;

  willDestroy() {
    this.tokenToUsdService.unregister(this);
  }

  compute([symbol, amount]: TokenToUsdHelperParams) {
    if (!VALID_SYMBOLS.includes(symbol)) {
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
}

export default TokenToUsdHelper;
