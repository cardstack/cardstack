import Service from '@ember/service';
import config from '../config/environment';
import { task, TaskGenerator } from 'ember-concurrency';
import { inject as service } from '@ember/service';
import HubAuthentication from './hub-authentication';

export interface MerchantInfo {
  did: string;
}

interface PersistMerchantInfoTaskParams {
  name: string;
  slug: string;
  color: string;
  textColor: string;
}

interface CheckMerchantSlugUniquenessTaskParams {
  slug: string;
}

export default class MerchantInfoService extends Service {
  @service declare hubAuthentication: HubAuthentication;

  @task *persistMerchantInfoTask(
    params: PersistMerchantInfoTaskParams
  ): TaskGenerator<MerchantInfo> {
    let response = yield fetch(`${config.hubURL}/api/merchant-infos`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer: ' + this.hubAuthentication.authToken,
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      },
      body: JSON.stringify({
        data: {
          type: 'merchant-infos',
          attributes: {
            name: params.name,
            slug: params.slug,
            color: params.color,
            'text-color': params.textColor,
          },
        },
      }),
    });
    let info = yield response.json();

    if (info.errors) {
      if (
        info.errors.length === 1 &&
        Number(info.errors[0].status) === 401 &&
        info.errors[0].title === 'No valid auth token'
      ) {
        console.error(
          'Failed to store merchant info due to invalid auth token'
        );
        this.hubAuthentication.authToken = null;
        throw new Error('No valid auth token');
      } else {
        // TODO: this should be changed to a form that communicates the errors
        console.error(
          'Failed to store merchant info, got errors:',
          info.errors
        );
        throw new Error('Failed to store merchant info');
      }
    }

    return {
      did: info.data.attributes.did,
    };
  }

  @task *checkMerchantSlugUniquenessTask(
    params: CheckMerchantSlugUniquenessTaskParams
  ): TaskGenerator<{
    slugAvailable: boolean;
    detail: string;
  }> {
    let response = yield fetch(
      `${config.hubURL}/api/merchant-infos/validate-slug/${params.slug}`,
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer: ' + this.hubAuthentication.authToken,
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
        },
      }
    );

    let info = yield response.json();

    if (info?.errors || !response.ok) {
      if (
        info?.errors?.length === 1 &&
        Number(info.errors[0].status) === 401 &&
        info.errors[0].title === 'No valid auth token'
      ) {
        this.hubAuthentication.authToken = null;
        throw new Error('No valid auth token');
      } else {
        throw new Error(yield response.text());
      }
    }

    return info;
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'merchant-info': MerchantInfoService;
  }
}
