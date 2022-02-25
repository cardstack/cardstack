import Route from '@ember/routing/route';
import '../css/pay.css';
import { inject as service } from '@ember/service';
import * as Sentry from '@sentry/browser';
import AppContextService from '@cardstack/ssr-web/services/app-context';
import config from '@cardstack/ssr-web/config/environment';
import { generateMerchantPaymentUrl, gqlQuery } from '@cardstack/cardpay-sdk';

interface UserSpaceRouteModel {
  id: string;
  name: string;
  backgroundColor: string;
  textColor: string;
  paymentURL: string;
}

export default class UserSpaceRoute extends Route {
  @service('app-context') declare appContext: AppContextService;

  async model(): Promise<UserSpaceRouteModel> {
    if (this.appContext.currentApp === 'card-space') {
      try {
        const cardSpaceResult: {
          included: any[];
        } = await (
          await fetch(
            `${config.hubURL || 'http://localhost:3000'}/api/card-spaces/${
              this.appContext.cardSpaceId
            }?include=merchant-info&FIXMEonlyhereforMirage`,
            {
              method: 'GET',
              headers: {
                Accept: 'application/vnd.api+json',
                'Content-Type': 'application/vnd.api+json',
              },
            }
          )
        ).json();
        let merchant = cardSpaceResult.included.find(
          (v) => v.type === 'merchant-infos'
        );
        if (!merchant) {
          // TODO: replace with proper 404 somehow
          // this 404 is for card space
          throw new Error('No such route!');
        }

        let queryResult = await gqlQuery(
          config.chains.layer2,
          `query($did: String!) {
          merchantSafes(where: { infoDid: $did }) {
            id
          }
        }`,
          {
            did: merchant.attributes.did,
          }
        );
        let address = queryResult?.data?.merchantSafes[0]?.id;

        // if (!address) {
        //   // TODO: replace with proper 404 somehow
        //   // this 404 is for card space
        //   throw new Error('No such route!');
        // }

        return {
          id: merchant.attributes['slug'],
          name: merchant.attributes['name'],
          backgroundColor: merchant.attributes['color'],
          textColor: merchant.attributes['text-color'],
          paymentURL: generateMerchantPaymentUrl({
            domain: config.universalLinkDomain,
            merchantSafeID: address,
            network: config.chains.layer2,
          }),
        };
      } catch (e) {
        Sentry.captureException(e);
        throw e;
      }
    } else {
      // TODO: replace with proper 404 somehow
      // this 404 is for wallet.
      throw new Error('No such route!');
    }
  }
}
