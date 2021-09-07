import Route from '@ember/routing/route';
import '../css/pay.css';
import CardPayLogo from '@cardstack/web-client/images/icons/card-pay-logo.svg';
import config from '@cardstack/web-client/config/environment';
import { viewSafe } from '@cardstack/cardpay-sdk';
import { getResolver } from '@cardstack/did-resolver';
import { Resolver } from 'did-resolver';

export default class CardPayTokenSuppliersRoute extends Route {
  async model(params: { network: string; merchant_safe_id: string }) {
    let merchantInfo: {
      name: string;
      logoBackground: string;
      logoTextColor: string;
    } | null = null;
    let resolver = new Resolver(getResolver());
    if (params.network !== 'xdai' && params.network !== 'sokol') {
      throw new Error('Unrecognized network');
    }

    let data = await viewSafe(params.network, params.merchant_safe_id);

    if (!data) throw new Error('no safe fetched');
    if (data.type !== 'merchant')
      throw new Error('Failed to fetch a merchant safe');
    if (!data.infoDID) throw new Error('No customization DID found');

    let did = await resolver.resolve(data.infoDID);
    let alsoKnownAs = did?.didDocument?.alsoKnownAs;

    if (alsoKnownAs) {
      let jsonApiDocument = await (await fetch(alsoKnownAs[0])).json();
      merchantInfo = {
        name: jsonApiDocument.data.attributes['name'],
        logoBackground: jsonApiDocument.data.attributes['color'],
        logoTextColor: jsonApiDocument.data.attributes['text-color'],
      };
    }

    return {
      network: params.network,
      merchantSafeID: params.merchant_safe_id,
      merchant: merchantInfo,
      cardPayLogo: CardPayLogo,
      supportURL: config.urls.discordBetaChannelLink,
      aboutURL: config.urls.testFlightLink,
    };
  }
}
