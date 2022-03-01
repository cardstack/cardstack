import Route from '@ember/routing/route';
import '../css/pay.css';
import { inject as service } from '@ember/service';
import * as Sentry from '@sentry/browser';
import AppContextService from '@cardstack/ssr-web/services/app-context';
import config from '@cardstack/ssr-web/config/environment';
import { generateMerchantPaymentUrl } from '@cardstack/cardpay-sdk';
import Fastboot from 'ember-cli-fastboot/services/fastboot';
import Subgraph from '../services/subgraph';

interface UserSpaceRouteModel {
  id: string;
  name: string;
  backgroundColor: string;
  textColor: string;
  paymentURL: string;
  deepLinkPaymentURL: string;
}

export default class UserSpaceRoute extends Route {
  @service('app-context') declare appContext: AppContextService;
  @service declare fastboot: Fastboot;
  @service declare subgraph: Subgraph;

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
          if (this.fastboot.isFastBoot) {
            this.fastboot.response.statusCode = 404;
          }
          throw new Error(
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
          if (this.fastboot.isFastBoot) {
            this.fastboot.response.statusCode = 404;
          }
          throw new Error(
            `404: Card Space not found for ${this.appContext.cardSpaceId}`
          );
        }

        let queryResult = await this.subgraph.query(
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
          deepLinkPaymentURL: generateMerchantPaymentUrl({
            merchantSafeID: address,
            network: config.chains.layer2,
          }),
        };
      } catch (e) {
        Sentry.captureException(e);
        throw e;
      }
    } else {
      if (this.fastboot.isFastBoot) {
        this.fastboot.response.statusCode = 404;
      }
      throw new Error("Oops! We couldn't find the page you were looking for");
    }
  }
}
