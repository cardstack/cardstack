import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import Subgraph from '@cardstack/ssr-web/services/subgraph';
import { MerchantSafe } from '@cardstack/cardpay-sdk';
import config from '../config/environment';
import { Profile } from '../resources/profile';
import AppContextService from '@cardstack/ssr-web/services/app-context';
import ProfileService from '@cardstack/ssr-web/services/profile';
import RouterService from '@ember/routing/router-service';
import { getSentry } from '../utils/sentry';

interface PayRouteModel {
  network: string;
  merchantSafe: MerchantSafe;
  profile: Profile | undefined;
  exchangeRates: any;
}

export default class PayRoute extends Route {
  @service declare router: RouterService;
  @service('subgraph') declare subgraph: Subgraph;
  @service('app-context') declare appContext: AppContextService;
  @service('profile') declare profile: ProfileService;
  sentry = getSentry();

  beforeModel() {
    if (this.profile.isActive) {
      this.router.transitionTo('index');
    }
  }

  async model(params: {
    currency: string;
    network: string;
    merchant_safe_id: string;
  }): Promise<PayRouteModel> {
    const { network } = params;
    try {
      const merchantSafe = (await this.fetchMerchantSafe(
        network,
        params.merchant_safe_id
      )) as MerchantSafe;

      // we're intentionally ignoring the infoDID being possibly undefined.
      // and letting the merchant info try to fetch and get into an errored state
      let profile = await this.fetchProfile(merchantSafe.infoDID!);

      return {
        network,
        merchantSafe,
        profile: profile,
        exchangeRates: this.shouldFetchExchangeRates
          ? await this.fetchExchangeRates('USD', params.currency)
          : undefined,
      };
    } catch (e) {
      this.sentry.captureException(e);
      throw e;
    }
  }

  get shouldFetchExchangeRates() {
    let params = this.paramsFor('pay') as { currency?: string };
    return (
      params && params.currency && !['USD', 'SPD'].includes(params.currency)
    );
  }

  async fetchExchangeRates(from: string, to: string) {
    try {
      return (
        await (
          await fetch(
            `${config.hubURL}/api/exchange-rates?from=${from}&to=${to}`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/vnd.api+json',
              },
            }
          )
        ).json()
      ).data.attributes.rates;
    } catch (e) {
      console.error('Failed to fetch exchange rates');
      this.sentry.captureException(e);
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

  async fetchProfile(infoDID: string) {
    // use a resource in a blocking manner
    // see https://github.com/NullVoxPopuli/ember-resources/issues/316
    let profile = Profile.from(this, () => ({
      infoDID,
      waitForInfo: false,
    }));
    await profile.run();

    return profile;
  }
}

function isLayer2Network(
  maybeNetwork: string
): maybeNetwork is 'sokol' | 'gnosis' {
  return maybeNetwork === 'gnosis' || maybeNetwork === 'sokol';
}
