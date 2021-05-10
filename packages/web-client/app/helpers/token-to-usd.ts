import Helper from '@ember/component/helper';
import BN from 'bn.js';
import { inject as service } from '@ember/service';
import Layer2Network from '@cardstack/web-client/services/layer2-network';

type TokenToUsdHelperParams = ['DAI' | 'CARD', BN];

class TokenToUsdHelper extends Helper {
  @service declare layer2Network: Layer2Network;

  compute([symbol, amount]: TokenToUsdHelperParams) {
    if (amount === null || amount === undefined) {
      return '';
    }
    const converter = this.layer2Network.usdConverters[symbol];
    if (!converter) return '';
    else {
      return converter(amount.toString()).toFixed(2);
    }
  }
}

export default TokenToUsdHelper;
