import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import Subgraph from '@cardstack/ssr-web/services/subgraph';
import * as Sentry from '@sentry/browser';
import { MerchantSafe } from '@cardstack/cardpay-sdk';
import config from '../config/environment';
import { getOwner } from '@ember/application';
import { MerchantInfo } from '../resources/merchant-info';
import AppContextService from '@cardstack/ssr-web/services/app-context';
import CardSpaceService from '@cardstack/ssr-web/services/card-space';

interface PayRouteModel {
  network: string;
  merchantSafe: MerchantSafe;
  merchantInfo: MerchantInfo | undefined;
  exchangeRates: any;
}

export default class PayRoute extends Route {
  @service('subgraph') declare subgraph: Subgraph;
  @service('app-context') declare appContext: AppContextService;
  @service('card-space') declare cardSpace: CardSpaceService;

  beforeModel() {
    if (this.cardSpace.isActive) {
      this.transitionTo('index');
    }
  }

  async model(params: {
    network: string;
    merchant_safe_id: string;
  }): Promise<PayRouteModel> {
    try {
      const merchantSafe = (await this.fetchMerchantSafe(
        params.network,
        params.merchant_safe_id
      )) as MerchantSafe;

      // we're intentionally ignoring the infoDID being possibly undefined.
      // and letting the merchant info try to fetch and get into an errored state
      let merchantInfo = await this.fetchMerchantInfo(merchantSafe.infoDID!);

      return {
        network: params.network,
        merchantSafe,
        merchantInfo,
        exchangeRates: this.shouldFetchExchangeRates
          ? await this.fetchExchangeRates()
          : undefined,
      };
    } catch (e) {
      Sentry.captureException(e);
      throw e;
    }
  }

  get shouldFetchExchangeRates() {
    let params = this.paramsFor('pay') as { currency?: string };
    return (
      params && params.currency && !['USD', 'SPD'].includes(params.currency)
    );
  }

  async fetchExchangeRates() {
    try {
      return (
        await (
          await fetch(`${config.hubURL}/api/exchange-rates`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/vnd.api+json',
            },
          })
        ).json()
      ).data.attributes.rates;
    } catch (e) {
      console.error('Failed to fetch exchange rates');
      Sentry.captureException(e);
      return {};
    }
  }

  async fetchMerchantSafe(network: string, address: string) {
    if (!isLayer2Network(network)) {
      throw new Error(
        `Failed to fetch information about merchant, network was unrecognized: ${network}`
      );
    }

    let data = (await this.subgraph.viewSafe(network, address)).safe;

    if (!data || data.type !== 'merchant')
      throw new Error(
        'Failed to fetch information about merchant, could not find a corresponding merchant safe'
      );

    return data;
  }

  async fetchMerchantInfo(infoDID: string) {
    // use a resource in a blocking manner
    // see https://github.com/NullVoxPopuli/ember-resources/issues/316
    let merchantInfo = new MerchantInfo(getOwner(this), {
      named: {
        infoDID,
        waitForInfo: false,
      },
    });
    await merchantInfo.run();

    return merchantInfo;
  }
}

function isLayer2Network(
  maybeNetwork: string
): maybeNetwork is 'sokol' | 'xdai' {
  return maybeNetwork === 'xdai' || maybeNetwork === 'sokol';
}
