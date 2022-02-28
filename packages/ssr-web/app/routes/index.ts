import Route from '@ember/routing/route';
import '../css/pay.css';
import { inject as service } from '@ember/service';
import * as Sentry from '@sentry/browser';
import AppContextService from '@cardstack/ssr-web/services/app-context';
import config from '@cardstack/ssr-web/config/environment';
import { generateMerchantPaymentUrl, gqlQuery } from '@cardstack/cardpay-sdk';
import Fastboot from 'ember-cli-fastboot/services/fastboot';

interface UserSpaceRouteModel {
  id: string;
  name: string;
  backgroundColor: string;
  textColor: string;
  paymentURL: string;
}

export default class UserSpaceRoute extends Route {
  @service('app-context') declare appContext: AppContextService;
  @service declare fastboot: Fastboot;

  async model(): Promise<UserSpaceRouteModel> {
    if (this.appContext.currentApp === 'card-space') {
      try {
        const response = await fetch(
          `${config.hubURL}/api/card-spaces/${this.appContext.cardSpaceId}`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/vnd.api+json',
              'Content-Type': 'application/vnd.api+json',
            },
          }
        );

        if (response.status === 404) {
          this.to404(
            `404: Card Space not found for ${this.appContext.cardSpaceId}`
          );
        }

        const cardSpaceResult: {
          included: any[];
        } = await response.json();

        let merchant = cardSpaceResult.included?.find(
          (v) => v.type === 'merchant-infos'
        );
        if (!merchant) {
          // TODO: replace with proper 404 somehow
          // this 404 is for card space

          this.to404(
            `404: Card Space not found for ${this.appContext.cardSpaceId}`
          );
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

  to404(message: string) {
    if (this.fastboot.isFastBoot) {
      this.fastboot.response.statusCode = 404;
    }

    throw new Error(message);
  }
}
