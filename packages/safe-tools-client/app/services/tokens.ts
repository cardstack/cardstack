import {
  fetchSupportedGasTokens,
  getConstantByNetwork,
  ChainAddress,
  TokenDetail,
} from '@cardstack/cardpay-sdk';
import NetworkService from '@cardstack/safe-tools-client/services/network';
import Service, { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { type TokenInfo } from '@uniswap/token-lists';
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
    const stubbedGasTokens = this._stubbedGasTokens;
    (async () => {
      try {
        state.value =
          stubbedGasTokens || (await fetchSupportedGasTokens(chainId));
      } catch (error) {
        state.error = error;
      } finally {
        state.isLoading = false;
      }
    })();
    return state;
  });

  get transactionTokens(): TokenInfo[] {
    if (this._stubbedTransactionTokens) {
      return this._stubbedTransactionTokens;
    }
    const tokens = getConstantByNetwork(
      'tokenList',
      this.network.symbol
    )?.tokens;
    if (tokens) {
      return sortBy(tokens, ['symbol', 'name']);
    }
    return [];
  }

  _stubbedTransactionTokens: TokenInfo[] | undefined;
  @tracked _stubbedGasTokens: TokenDetail[] | undefined;

  stubGasTokens(val: TokenDetail[]) {
    this._stubbedGasTokens = val;
  }

  stubTransactionTokens(val: TokenInfo[]) {
    this._stubbedTransactionTokens = val;
  }

  tokenFromAddress(address: ChainAddress): TokenInfo | undefined {
    return this.transactionTokens.find((t) => t.address === address);
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    tokens: TokensService;
  }
}
