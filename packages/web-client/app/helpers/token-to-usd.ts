import Helper from '@ember/component/helper';
import BN from 'bn.js';
import { inject as service } from '@ember/service';
import TokenToUsd from '@cardstack/web-client/services/token-to-usd';

type TokenToUsdHelperParams = ['DAI' | 'CARD', BN];

class TokenToUsdHelper extends Helper {
  @service('token-to-usd') declare tokenToUsdService: TokenToUsd;
  symbol: 'DAI' | 'CARD' | undefined;
  amount: BN | undefined;

  constructor() {
    super(...arguments);
    this.tokenToUsdService.register(this);
  }

  willDestroy() {
    this.tokenToUsdService.unregister(this);
  }

  compute([symbol, amount]: TokenToUsdHelperParams) {
    if (amount === null || amount === undefined) {
      return '';
    }
    this.symbol = symbol;
    this.amount = amount;
    return this.tokenToUsdService.toUsdFrom(symbol, amount);
  }
}

export default TokenToUsdHelper;
