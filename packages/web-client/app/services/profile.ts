import Service from '@ember/service';
import config from '../config/environment';
import { task, TaskGenerator } from 'ember-concurrency';
import { inject as service } from '@ember/service';
import HubAuthentication from './hub-authentication';

export interface ProfileInfo {
  did: string;
}

interface PersistProfileInfoTaskParams {
  name: string;
  slug: string;
  color: string;
  textColor: string;
}

interface checkProfileSlugUniquenessTaskParams {
  slug: string;
}

export default class ProfileService extends Service {
  @service declare hubAuthentication: HubAuthentication;

  @task *persistProfileInfoTask(
    params: PersistProfileInfoTaskParams
  ): TaskGenerator<ProfileInfo> {
    let response = yield fetch(`${config.hubURL}/api/profiles`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + this.hubAuthentication.authToken,
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      },
      body: JSON.stringify({
        data: {
          type: 'profiles',
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
        console.error('Failed to store profile due to invalid auth token');
        this.hubAuthentication.authToken = null;
        throw new Error('No valid auth token');
      } else {
        // TODO: this should be changed to a form that communicates the errors
        console.error('Failed to store profile, got errors:', info.errors);
        throw new Error('Failed to store profile');
      }
    }

    return {
      did: info.data.attributes.did,
    };
  }

  @task *checkProfileSlugUniquenessTask(
    params: checkProfileSlugUniquenessTaskParams
  ): TaskGenerator<{
    slugAvailable: boolean;
    detail: string;
  }> {
    let response = yield fetch(
      `${config.hubURL}/api/profiles/validate-slug/${params.slug}`,
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + this.hubAuthentication.authToken,
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
    profile: ProfileService;
  }
}
