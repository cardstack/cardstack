import { HubConfig } from '@cardstack/cardpay-sdk';
import { HubConfigResponse } from '@cardstack/cardpay-sdk/sdk/hub-config';
import config from '@cardstack/safe-tools-client/config/environment';
import Service from '@ember/service';
import { use, resource } from 'ember-resources';
import { TrackedObject } from 'tracked-built-ins';

interface HubConfigState {
  isLoading: boolean;
  value?: HubConfigResponse;
  error?: Error;
}

export default class HubConfigService extends Service {
  @use remoteConfig = resource(() => {
    const state: HubConfigState = new TrackedObject({
      isLoading: true,
    });
    const hubConfigApi = new HubConfig(config.hubUrl);

    (async () => {
      try {
        state.value = await hubConfigApi.getConfig();
      } catch (error) {
        console.error(error);
        state.error = error;
      } finally {
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
