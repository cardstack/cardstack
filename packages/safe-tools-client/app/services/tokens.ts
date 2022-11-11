import { fetchSupportedGasTokens, TokenDetail } from '@cardstack/cardpay-sdk';
import NetworkService from '@cardstack/safe-tools-client/services/network';
import Service, { inject as service } from '@ember/service';
import { use, resource } from 'ember-resources';
import { TrackedObject } from 'tracked-built-ins';

interface GasTokenResourceState extends Record<PropertyKey, unknown> {
  error?: Error;
  isLoading: boolean;
  value?: TokenDetail[];
}

export default class TokensService extends Service {
  @service declare network: NetworkService;

  @use gasTokens = resource(() => {
    const state = new TrackedObject({
      isLoading: true,
    } as GasTokenResourceState);

    // because networkInfo is tracked, anytime the network switches,
    // this resource will re-run
    (async () => {
      try {
        state.value = await fetchSupportedGasTokens(
          this.network.networkInfo.chainId
        );
      } catch (error) {
        state.error = error;
      } finally {
        state.isLoading = false;
      }
    })();
    // TODO: enrich gas token array with icons so the result looks like:
    //     [{ name: 'CARD', ..., icon: 'card' },
    //      { name: 'HI', ..., icon: 'emoji' },
    //      { name: 'WORLD', ..., icon: 'world' }]

    return state;
  });
}
