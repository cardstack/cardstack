import Helper from '@ember/component/helper';
import { BigNumber } from '@ethersproject/bignumber';
import { inject as service } from '@ember/service';
import TokenToUsdService from '../services/token-to-usd';

type TokenToUsdHelperParams = ['DAI' | 'ETH' | 'CARD', BigNumber];

class TokenToUsdHelper extends Helper {
  @service declare tokenToUsd: TokenToUsdService;

  compute([symbol, amount]: TokenToUsdHelperParams /*, hash*/) {
    if (amount == null) {
      return null;
    }
    const res = this.tokenToUsd.weiToUsd(symbol, amount);
    return res;
  }
}

export default TokenToUsdHelper;
