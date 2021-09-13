import Route from '@ember/routing/route';
import '../css/pay.css';
import CardPayLogo from '@cardstack/web-client/images/icons/card-pay-logo.svg';
import config from '@cardstack/web-client/config/environment';
import { getResolver } from '@cardstack/did-resolver';
import { Resolver } from 'did-resolver';
import { inject as service } from '@ember/service';
import SafeViewer from '@cardstack/web-client/services/safe-viewer';
import { fetchOffChainJson } from '../utils/fetch-off-chain-json';
import * as Sentry from '@sentry/browser';
import { MerchantSafe } from '@cardstack/cardpay-sdk';

interface PayRouteModel {
  cardPayLogo: string;
  supportURL: string;
  aboutURL: string;
  network: string;
  merchantSafeID: string;
  merchantExists: boolean;
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
      merchantExists: false,
      merchant: null,
      errored: true,
    };

    try {
      let merchantSafe = await this.fetchMerchantSafe(
        params.network,
        params.merchant_safe_id
      );
      if (merchantSafe) {
        res.merchantExists = true;
      }
      res.merchant = await this.fetchMerchantInfo(merchantSafe);
      res.errored = false;
    } catch (e) {
      console.error(e);
      Sentry.captureException(e);
    }

    return res;
  }

  async fetchMerchantSafe(network: string, address: string) {
    if (network !== 'xdai' && network !== 'sokol') {
      throw new Error(
        `Failed to fetch information about merchant, network was unrecognized: ${network}`
      );
    }

    let data = await this.safeViewer.view(network, address);

    if (!data || data.type !== 'merchant')
      throw new Error(
        'Failed to fetch information about merchant, could not find a corresponding merchant safe'
      );

    return data;
  }

  async fetchMerchantInfo(safe: MerchantSafe) {
    if (!safe.infoDID) {
      throw new Error(
        'Failed to fetch information about merchant, missing DID'
      );
    }
    let resolver = new Resolver(getResolver());
    let did = await resolver.resolve(safe.infoDID);
    let resourceUrl = did?.didDocument?.alsoKnownAs?.[0];

    if (!resourceUrl)
      throw new Error(
        `Failed to fetch information about merchant, could not retrieve resource from DID: ${did}`
      );

    let jsonApiDocument = await fetchOffChainJson(resourceUrl, true);

    return {
      name: jsonApiDocument.data.attributes['name'],
      logoBackground: jsonApiDocument.data.attributes['color'],
      logoTextColor: jsonApiDocument.data.attributes['text-color'],
    };
  }
}
