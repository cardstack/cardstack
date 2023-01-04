import TokenToUsdService from '@cardstack/safe-tools-client/services/token-to-usd';
import Helper from '@ember/component/helper';
import { inject as service } from '@ember/service';
import { BigNumber } from 'ethers';

type TokenToUsdHelperParams = [string, BigNumber];

class TokenToUsdHelper extends Helper {
  @service('token-to-usd') declare tokenToUsdService: TokenToUsdService;

  tokenAddress: string | undefined;
  amount: BigNumber | undefined;

  compute([tokenAddress, amount]: TokenToUsdHelperParams):
    | BigNumber
    | undefined {
    if (amount === null || amount === undefined) {
      return undefined;
    }
    this.tokenAddress = tokenAddress;
    this.amount = BigNumber.from(amount);

    if (this.amount && this.amount.gt(0)) {
      this.tokenToUsdService.register(this);
      return this.tokenToUsdService.toUsdFrom(tokenAddress, this.amount);
    } else {
      return BigNumber.from(0);
    }
  }

  willDestroy() {
    this.tokenToUsdService.unregister(this);
  }
}

export default TokenToUsdHelper;
