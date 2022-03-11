import Route from '@ember/routing/route';
import '../css/pay.css';
import { inject as service } from '@ember/service';
import * as Sentry from '@sentry/browser';
import AppContextService from '@cardstack/ssr-web/services/app-context';
import config from '@cardstack/ssr-web/config/environment';
import Fastboot from 'ember-cli-fastboot/services/fastboot';

interface CardSpaceIndexRouteModel {
  did: string;
  id: string;
  name: string;
  backgroundColor: string;
  textColor: string;
}

export default class IndexRoute extends Route {
  @service('app-context') declare appContext: AppContextService;
  @service declare fastboot: Fastboot;

  async model(): Promise<CardSpaceIndexRouteModel> {
    if (this.appContext.isELBHealthChecker) {
      return {
        did: '',
        id: '',
        name: '',
        backgroundColor: '',
        textColor: '',
      };
    } else if (this.appContext.isCardSpace) {
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

        return {
          did: merchant.attributes['did'],
          id: merchant.attributes['slug'],
          name: merchant.attributes['name'],
          backgroundColor: merchant.attributes['color'],
          textColor: merchant.attributes['text-color'],
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
