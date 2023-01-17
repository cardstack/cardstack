import { SelectableToken } from '@cardstack/boxel/components/boxel/input/selectable-token';
import { ChainAddress } from '@cardstack/cardpay-sdk';
import config from '@cardstack/safe-tools-client/config/environment';
import { nativeUnitsToDecimal } from '@cardstack/safe-tools-client/helpers/native-units-to-decimal';
import TokenToUsdService from '@cardstack/safe-tools-client/services/token-to-usd';
import TokenQuantity from '@cardstack/safe-tools-client/utils/token-quantity';
import Helper from '@ember/component/helper';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import { BigNumber } from 'ethers';

type NamedArgs = {
  tokenAddress?: string;
  tokenAmount?: BigNumber;
  tokenDecimals?: number;
  tokenQuantity?: TokenQuantity;
};

interface Signature {
  Args: {
    Named: NamedArgs;
  };
  Return: string;
}

const INTERVAL = config.environment === 'test' ? 1000 : 60 * 1000;

export default class TokenToUsdHelper extends Helper<Signature> {
  @service('token-to-usd') declare tokenToUsdService: TokenToUsdService;
  updateInterval: ReturnType<typeof setInterval> | undefined;
  tokenAddress: ChainAddress | undefined;

  compute(_positional: never, named: NamedArgs): string {
    let tokenAddress: ChainAddress,
      tokenAmount: BigNumber,
      tokenDecimals: number;
    const tokenQuantity = named.tokenQuantity;
    if (tokenQuantity) {
      tokenAddress = tokenQuantity.address;
      tokenAmount = tokenQuantity.count;
      tokenDecimals = tokenQuantity.decimals;
    } else {
      named = named as NamedArgs;
      tokenAddress = named.tokenAddress as string;
      tokenAmount = named.tokenAmount as BigNumber;
      tokenDecimals = named.tokenDecimals as number;
    }

    this.ensureTimer(tokenAddress);
    const usdcAmount = this.computeUsdcAmount(
      tokenAddress,
      tokenAmount,
      tokenDecimals
    );
    if (usdcAmount) {
      return `$ ${nativeUnitsToDecimal([usdcAmount, tokenDecimals, 2])}`;
    }
    return 'Converting to USD...';
  }

  ensureTimer(tokenAddress: ChainAddress) {
    if (tokenAddress !== this.tokenAddress) {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = undefined;
      }
      this.tokenAddress = tokenAddress;
    }
    if (!this.updateInterval) {
      this.updateInterval = setInterval(() => {
        taskFor(this.tokenToUsdService.updateUsdcRate).perform(tokenAddress);
      }, INTERVAL);
      // the first execution above will happen after a delay of INTERVAL so we kick it off immediately as well
      taskFor(this.tokenToUsdService.updateUsdcRate).perform(tokenAddress);
    }
  }

  computeUsdcAmount(
    tokenAddress: ChainAddress,
    amount: BigNumber,
    decimals: number
  ) {
    const token: SelectableToken = {
      address: tokenAddress,
      name: 'unknown',
      symbol: 'unknown',
      decimals: decimals,
    };
    const tokenQuantity = new TokenQuantity(token, BigNumber.from(amount));
    return this.tokenToUsdService.toUsdc(tokenQuantity);
  }

  willDestroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }
}
