import { HubConfig } from '@cardstack/cardpay-sdk';
import { HubConfigResponse } from '@cardstack/cardpay-sdk/sdk/hub-config';
import { Deferred } from '@cardstack/ember-shared';
import config from '@cardstack/safe-tools-client/config/environment';
import Service from '@ember/service';
import { use, resource } from 'ember-resources';
import { TrackedObject } from 'tracked-built-ins';

interface HubConfigState {
  ready: Promise<void>;
  isLoading: boolean;
  value?: HubConfigResponse;
  error?: Error;
}

export default class HubConfigService extends Service {
  @use remoteConfig = resource(() => {
    const readyDeferred = new Deferred<void>();

    const state: HubConfigState = new TrackedObject({
      isLoading: true,
      ready: readyDeferred.promise,
    });
    const hubConfigApi = new HubConfig(config.hubUrl);

    (async () => {
      try {
        state.value = await hubConfigApi.getConfig();
      } catch (error) {
        console.error(error);
        state.error = error;
      } finally {
        readyDeferred.fulfill();
        state.isLoading = false;
      }
    })();
    return state;
  });
}

declare module '@ember/service' {
  interface Registry {
    'hub-config': HubConfigService;
  }
}
