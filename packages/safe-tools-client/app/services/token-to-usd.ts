import config from '@cardstack/safe-tools-client/config/environment';
import TokenToUsdHelper from '@cardstack/safe-tools-client/helpers/token-to-usd';
import ScheduledPaymentsSdkService from '@cardstack/safe-tools-client/services/scheduled-payments-sdk';
import TokensService from '@cardstack/safe-tools-client/services/tokens';
import Service, { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { rawTimeout, waitForQueue } from 'ember-concurrency';
import { task } from 'ember-concurrency-decorators';
import { taskFor } from 'ember-concurrency-ts';
import { BigNumber } from 'ethers';

const INTERVAL = config.environment === 'test' ? 1000 : 60 * 1000;

type ConversionFunction = (amountInWei: BigNumber) => BigNumber;
export type UsdConverter = Record<string, ConversionFunction>;

export default class TokenToUsdService extends Service {
  @tracked usdConverters: UsdConverter = {};
  @service declare scheduledPaymentsSdk: ScheduledPaymentsSdkService;
  @service declare tokens: TokensService;
  #registeredHelpers: Set<TokenToUsdHelper> = new Set();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @task({ maxConcurrency: 1, restartable: true }) *pollTask(): any {
    while (this.shouldPoll) {
      yield waitForQueue('afterRender'); // wait for all current helpers to be registered
      const { addressesToUpdate } = this;
      const updatedConverters =
        yield this.scheduledPaymentsSdk.updateUsdConverters(addressesToUpdate);
      for (const addressToUpdate of addressesToUpdate) {
        this.usdConverters[addressToUpdate] =
          updatedConverters[addressToUpdate];
      }

      // eslint-disable-next-line no-self-assign
      this.usdConverters = this.usdConverters; // to trigger reload value
      yield rawTimeout(INTERVAL); // rawTimeout used to avoid hanging tests
    }
  }

  get addressesToUpdate(): string[] {
    const res: string[] = [];

    // Only update transaction tokens of current network
    const { transactionTokens } = this.tokens;
    for (const helper of this.#registeredHelpers.values()) {
      if (
        helper.tokenAddress &&
        helper.amount?.gt(0) &&
        transactionTokens.find((t) => t.address === helper.tokenAddress)
      ) {
        res.push(helper.tokenAddress);
      }
    }

    return res.sort();
  }

  get shouldPoll(): boolean {
    return this.#registeredHelpers.size > 0;
  }

  toUsdFrom(tokenAddress: string, amount: BigNumber): BigNumber {
    if (amount.isZero()) {
      return BigNumber.from(0);
    }
    return this.usdConverters[tokenAddress]?.(amount);
  }

  register(helper: TokenToUsdHelper) {
    const before = this.addressesToUpdate;
    this.#registeredHelpers.add(helper);
    const after = this.addressesToUpdate;
    if (before.join() !== after.join()) {
      taskFor(this.pollTask).perform();
    }
  }

  unregister(helper: TokenToUsdHelper) {
    this.#registeredHelpers.delete(helper);
  }
}

declare module '@ember/service' {
  interface Registry {
    'token-to-usd': TokenToUsdService;
  }
}
