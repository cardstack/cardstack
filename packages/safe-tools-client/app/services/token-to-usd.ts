import { getUsdConverter } from '@cardstack/cardpay-sdk';
import config from '@cardstack/safe-tools-client/config/environment';
import TokensService from '@cardstack/safe-tools-client/services/tokens';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import Service, { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { addMilliseconds } from 'date-fns';
import { task } from 'ember-concurrency';
import { BigNumber } from 'ethers';

const INTERVAL = config.environment === 'test' ? 3000 : 60 * 3000;

export default class TokenToUsdService extends Service {
  @tracked usdConverters: Record<
    string,
    (amountInWei: BigNumber) => BigNumber
  > = {};
  convertersLastUpdate: Record<string, Date> = {};
  @service declare wallet: WalletService;
  @service declare tokens: TokensService;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @task({ maxConcurrency: 1, enqueue: true }) *updateUsdConverter(
    tokenAddress: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    const now = new Date();
    if (
      !this.convertersLastUpdate[tokenAddress] ||
      addMilliseconds(this.convertersLastUpdate[tokenAddress], INTERVAL) < now
    ) {
      this.usdConverters[tokenAddress] = yield getUsdConverter(
        this.wallet.ethersProvider,
        tokenAddress
      );
      // eslint-disable-next-line no-self-assign
      this.usdConverters = this.usdConverters;

      this.convertersLastUpdate[tokenAddress] = now;
    }
  }

  toUsd(tokenAddress: string, amount: BigNumber): BigNumber | undefined {
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
