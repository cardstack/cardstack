import config from '@cardstack/safe-tools-client/config/environment';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import TokensService from '@cardstack/safe-tools-client/services/tokens';
import Service, { inject as service } from '@ember/service';
import { task } from 'ember-concurrency';
import { BigNumber } from 'ethers';
import { addMilliseconds } from 'date-fns';
import { tracked } from '@glimmer/tracking';
import { getUsdConverter } from '@cardstack/cardpay-sdk';

const INTERVAL = config.environment === 'test' ? 3000 : 60 * 3000;

export default class TokenToUsdService extends Service {
  @tracked usdConverters: Record<string, (amountInWei: BigNumber) => BigNumber> = {};
  convertersLastUpdate: Record<string, Date> = {};
  @service declare wallet: WalletService;
  @service declare tokens: TokensService;

  @task({maxConcurrency: 1, enqueue: true}) *updateUsdConverter(tokenAddress: string): any {
    let now = new Date();
    if(!this.convertersLastUpdate[tokenAddress] || addMilliseconds(this.convertersLastUpdate[tokenAddress], INTERVAL) < now) {
      this.usdConverters[tokenAddress] = yield getUsdConverter(this.wallet.ethersProvider, tokenAddress);
      this.usdConverters = this.usdConverters;

      this.convertersLastUpdate[tokenAddress] = now;
    }
  }

  toUsdFrom(tokenAddress: string, amount: BigNumber): BigNumber | undefined {
    if (amount.isZero()) {
      return BigNumber.from(0);
    }
    return this.usdConverters[tokenAddress]?.(amount);
  }
}

declare module '@ember/service' {
  interface Registry {
    'token-to-usd': TokenToUsdService;
  }
}
