import {
  applyRateToAmount,
  ChainAddress,
  getUsdcToTokenRate,
  TokenDetail,
} from '@cardstack/cardpay-sdk';
import config from '@cardstack/safe-tools-client/config/environment';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import TokenQuantity from '@cardstack/safe-tools-client/utils/token-quantity';
import Service, { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { addMilliseconds } from 'date-fns';
import { task } from 'ember-concurrency';
import { BigNumber, FixedNumber } from 'ethers';
import { TrackedMap } from 'tracked-built-ins';

const INTERVAL = config.environment === 'test' ? 3000 : 60 * 3000;

export default class TokenToUsdService extends Service {
  @tracked usdcTokenRates = new TrackedMap<
    ChainAddress, // token address
    FixedNumber // token to usd rate
  >();
  ratesLastUpdate: Record<ChainAddress, Date> = {};
  @service declare wallet: WalletService;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @task({ maxConcurrency: 1, enqueue: true }) *updateUsdcRate(
    tokenAddress: ChainAddress
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    const now = new Date();
    if (
      !this.ratesLastUpdate[tokenAddress] ||
      addMilliseconds(this.ratesLastUpdate[tokenAddress], INTERVAL) < now
    ) {
      this.usdcTokenRates.set(
        tokenAddress,
        yield getUsdcToTokenRate(this.wallet.ethersProvider, tokenAddress)
      );
      this.ratesLastUpdate[tokenAddress] = now;
    }
  }

  toUsdc(tokenQuantity: TokenQuantity): BigNumber | undefined {
    const rate = this.usdcTokenRates.get(tokenQuantity.address);
    if (!rate) {
      return undefined;
    }
    return applyRateToAmount(rate, tokenQuantity.count);
  }

  getTokenToUsdcRate(token: TokenDetail): FixedNumber | undefined {
    return this.usdcTokenRates.get(token.address);
  }

  getUsdcToTokenRate(token: TokenDetail): FixedNumber | undefined {
    const gasTokenToUsdcRate = this.usdcTokenRates.get(token.address);
    if (gasTokenToUsdcRate) {
      return FixedNumber.from(1).divUnsafe(gasTokenToUsdcRate);
    } else {
      return undefined;
    }
  }
}

declare module '@ember/service' {
  interface Registry {
    'token-to-usd': TokenToUsdService;
  }
}
