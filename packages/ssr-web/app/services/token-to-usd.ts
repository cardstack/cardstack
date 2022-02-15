import { inject as service, default as Service } from '@ember/service';
import Layer1Network from '@cardstack/ssr-web/services/layer1-network';
import Layer2Network from '@cardstack/ssr-web/services/layer2-network';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency-decorators';
import { taskFor } from 'ember-concurrency-ts';
import { all, rawTimeout, waitForQueue } from 'ember-concurrency';
import BN from 'bn.js';

import TokenToUsdHelper from '@cardstack/ssr-web/helpers/token-to-usd';
import {
  ConversionFunction,
  isBridgedTokenSymbol,
} from '@cardstack/ssr-web/utils/token';
import config from '@cardstack/ssr-web/config/environment';

const INTERVAL = config.environment === 'test' ? 1000 : 60 * 1000;

export type UsdConvertibleSymbol = 'CARD.CPXD' | 'DAI.CPXD' | 'ETH';
const USD_CONVERTIBLE_SYMBOLS = ['CARD.CPXD', 'DAI.CPXD', 'ETH'];

class UsdConverters {
  @tracked 'DAI.CPXD': ConversionFunction | undefined;
  @tracked 'CARD.CPXD': ConversionFunction | undefined;
  @tracked 'ETH': ConversionFunction | undefined;
}

/*
  The TokenToUsd service is responsible for efficiently polling for
  up-to-date exchange rate converters from the Layer2Network service.
  TokenToUsd helper instances register themselves with this service
  so that they can be inspected. The service uses this inspection
  to deduce whether a polling loop is necessary at all, and if so,
  what tokens need exchange functions fetched.
*/
export default class TokenToUsd extends Service {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  usdConverters = new UsdConverters();
  #registeredHelpers: Set<TokenToUsdHelper> = new Set();

  @task({ maxConcurrency: 1, restartable: true }) *pollTask(): any {
    while (this.shouldPoll) {
      yield waitForQueue('afterRender'); // wait for all current helpers to be registered
      let { symbolsToUpdate } = this;
      let updatedConverters = yield all([
        this.layer1Network.updateUsdConverters(
          symbolsToUpdate.filter((s) => !isBridgedTokenSymbol(s))
        ),
        this.layer2Network.updateUsdConverters(
          symbolsToUpdate.filter(isBridgedTokenSymbol)
        ),
      ]);
      updatedConverters = Object.assign({}, ...updatedConverters);
      for (let symbol of USD_CONVERTIBLE_SYMBOLS) {
        this.usdConverters[symbol as UsdConvertibleSymbol] =
          updatedConverters[symbol];
      }
      yield rawTimeout(INTERVAL); // rawTimeout used to avoid hanging tests
    }
  }

  /* Inspects registered helper instances to determine which symbols
     should be updated. Ignores cases where the amount is zero.
   */
  get symbolsToUpdate(): UsdConvertibleSymbol[] {
    let unfoundSymbols = [...USD_CONVERTIBLE_SYMBOLS];
    let res: UsdConvertibleSymbol[] = [];
    for (let helper of this.#registeredHelpers.values()) {
      if (
        helper.symbol &&
        unfoundSymbols.includes(helper.symbol) &&
        helper.amount?.gt(new BN(0))
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

  toUsdFrom(
    symbol: UsdConvertibleSymbol | 'DAI' | 'CARD',
    amount: BN
  ): number | undefined {
    if (symbol === 'DAI') {
      symbol = 'DAI.CPXD';
    }

    if (symbol === 'CARD') {
      symbol = 'CARD.CPXD';
    }

    if (amount.isZero()) {
      return 0;
    }
    return this.usdConverters[symbol]?.(amount.toString());
  }

  // safe to call multiple times -- calls to the `pollTask` are
  // dropped if it is already running
  register(helper: TokenToUsdHelper) {
    let before = this.symbolsToUpdate;
    this.#registeredHelpers.add(helper);
    let after = this.symbolsToUpdate;
    if (before.join() !== after.join()) {
      taskFor(this.pollTask).perform();
    }
  }

  unregister(helper: TokenToUsdHelper) {
    this.#registeredHelpers.delete(helper);
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'token-to-usd': TokenToUsd;
  }
}
