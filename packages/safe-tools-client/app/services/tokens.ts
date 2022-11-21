import {
  fetchSupportedGasTokens,
  getConstantByNetwork,
  TokenDetail,
} from '@cardstack/cardpay-sdk';
import NetworkService from '@cardstack/safe-tools-client/services/network';
import Service, { inject as service } from '@ember/service';
import { use, resource } from 'ember-resources';
import sortBy from 'lodash/sortBy';
import { TrackedObject } from 'tracked-built-ins';

interface GasTokenResourceState extends Record<PropertyKey, unknown> {
  error?: Error;
  isLoading: boolean;
  value?: TokenDetail[];
}

export default class TokensService extends Service {
  @service declare network: NetworkService;

  @use gasTokens = resource(() => {
    const state: GasTokenResourceState = new TrackedObject({
      isLoading: true,
    });

    // because networkInfo is tracked, anytime the network switches,
    // this resource will re-run
    const chainId = this.network.networkInfo.chainId;
    (async () => {
      try {
        state.value = await fetchSupportedGasTokens(chainId);
      } catch (error) {
        state.error = error;
      } finally {
        state.isLoading = false;
      }
    })();
    return state;
  });

  get transactionTokens() {
    const tokens = getConstantByNetwork(
      'tokenList',
      this.network.networkInfo.symbol
    )?.tokens;
    if (tokens) {
      return sortBy(tokens, ['symbol', 'name']);
    }
    return [];
  }
}
