import Route from '@ember/routing/route';
import '../css/pay.css';
import CardPayLogo from '@cardstack/web-client/images/icons/card-pay-logo.svg';
import config from '@cardstack/web-client/config/environment';
import { getResolver } from '@cardstack/did-resolver';
import { Resolver } from 'did-resolver';
import { inject as service } from '@ember/service';
import SafeViewer from '@cardstack/web-client/services/safe-viewer';
import { fetchOffChainJson } from '../utils/fetch-off-chain-json';

interface PayRouteModel {
  cardPayLogo: string;
  supportURL: string;
  aboutURL: string;
  network: string;
  merchantSafeID: string;
  merchant: null | {
    name: string;
    logoBackground: string;
    logoTextColor: string;
  };
  errored: boolean;
}

export default class PayRoute extends Route {
  @service('safe-viewer') declare safeViewer: SafeViewer;

  async model(params: { network: string; merchant_safe_id: string }) {
    let res: PayRouteModel = {
      cardPayLogo: CardPayLogo,
      supportURL: config.urls.discordBetaChannelLink,
      aboutURL: config.urls.testFlightLink,
      network: params.network,
      merchantSafeID: params.merchant_safe_id,
      merchant: null,
      errored: true,
    };

    try {
      res.merchant = await this.fetchMerchantInfoFromSafeAddress(
        params.network,
        params.merchant_safe_id
      );
      res.errored = false;
    } catch (e) {
      console.error(e);
      // Need some thoughts about when to capture to Sentry
      // Sentry.captureException(e);
    }

    return res;
  }

  async fetchMerchantInfoFromSafeAddress(network: string, address: string) {
    if (network !== 'xdai' && network !== 'sokol') {
      throw new Error(
        `Failed to fetch information about merchant, network was unrecognized: ${network}`
      );
    }

    let data = await this.safeViewer.view(network, address);

    if (!data || data.type !== 'merchant' || !data.infoDID)
      throw new Error(
        `Failed to fetch information about merchant, could not find a corresponding merchant safe or details`
      );

    let resolver = new Resolver(getResolver());
    let did = await resolver.resolve(data.infoDID);
    let resourceUrl = did?.didDocument?.alsoKnownAs?.[0];

    if (!resourceUrl)
      throw new Error(
        'Failed to fetch information about merchant, could not find a corresponding merchant safe or details'
      );

    let jsonApiDocument = await fetchOffChainJson(resourceUrl, true);

    return {
      name: jsonApiDocument.data.attributes['name'],
      logoBackground: jsonApiDocument.data.attributes['color'],
      logoTextColor: jsonApiDocument.data.attributes['text-color'],
    };
  }
}
