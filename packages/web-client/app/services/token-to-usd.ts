import { inject as service, default as Service } from '@ember/service';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency-decorators';
import { taskFor } from 'ember-concurrency-ts';
import { rawTimeout, waitForQueue } from 'ember-concurrency';
import BN from 'bn.js';
import { toBN } from 'web3-utils';
import TokenToUsdHelper from '@cardstack/web-client/helpers/token-to-usd';
import {
  ConvertibleSymbol,
  ConversionFunction,
} from '@cardstack/web-client/utils/web3-strategies/types';
import config from '@cardstack/web-client/config/environment';

const INTERVAL = config.environment === 'test' ? 1000 : 60 * 1000;

class UsdConverters {
  @tracked DAI: ConversionFunction | undefined;
  @tracked CARD: ConversionFunction | undefined;
}

export default class TokenToUsd extends Service {
  @service declare layer2Network: Layer2Network;
  usdConverters = new UsdConverters();
  #registeredHelpers: Set<TokenToUsdHelper> = new Set();

  @task({ maxConcurrency: 1, drop: true }) *pollTask(): any {
    while (this.shouldPoll) {
      yield waitForQueue('afterRender');
      const updatedConverters = yield this.layer2Network.updateUsdConverters(
        this.symbolsToUpdate
      );
      for (const symbol of ['DAI', 'CARD'] as ConvertibleSymbol[]) {
        this.usdConverters[symbol] = updatedConverters[symbol];
      }
      yield rawTimeout(INTERVAL);
    }
  }

  get symbolsToUpdate(): ConvertibleSymbol[] {
    let unfoundSymbols: ConvertibleSymbol[] = ['DAI', 'CARD'];
    let res: ConvertibleSymbol[] = [];
    for (let helper of this.#registeredHelpers.values()) {
      if (
        helper.symbol &&
        unfoundSymbols.includes(helper.symbol) &&
        helper.amount?.gt(toBN(0))
      ) {
        unfoundSymbols = unfoundSymbols.filter((v) => v !== helper.symbol);
        res.push(helper.symbol);
      }

      if (unfoundSymbols.length === 0) {
        break;
      }
    }

    return res.sort();
  }

  get shouldPoll(): boolean {
    return this.#registeredHelpers.size > 0;
  }

  toUsdFrom(symbol: ConvertibleSymbol, amount: BN): string | undefined {
    if (amount.isZero()) {
      return '0.00';
    }

    return this.usdConverters[symbol]?.(amount.toString()).toFixed(2);
  }

  register(helper: TokenToUsdHelper) {
    this.#registeredHelpers.add(helper);
    taskFor(this.pollTask).perform();
  }

  unregister(helper: TokenToUsdHelper) {
    this.#registeredHelpers.delete(helper);
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  // eslint-disable-next-line no-unused-vars
  interface Registry {
    'token-to-usd': TokenToUsd;
  }
}
