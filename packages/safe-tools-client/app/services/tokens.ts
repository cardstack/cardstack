import {
  fetchSupportedGasTokens,
  getConstantByNetwork,
  ChainAddress,
  TokenDetail,
} from '@cardstack/cardpay-sdk';
import NetworkService from '@cardstack/safe-tools-client/services/network';
import Service, { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { use, resource } from 'ember-resources';
import sortBy from 'lodash/sortBy';
import { TrackedObject } from 'tracked-built-ins';

interface GasTokenResourceState extends Record<PropertyKey, unknown> {
  error?: Error;
  isLoading: boolean;
  value?: TokenDetail[];
  load: () => Promise<void>;
}

export default class TokensService extends Service {
  @service declare network: NetworkService;

  @use gasTokens = resource(() => {
    // because networkInfo is tracked, anytime the network switches,
    // this resource will re-run
    const chainId = this.network.networkInfo.chainId;
    const stubbedGasTokens = this._stubbedGasTokens;

    const state: GasTokenResourceState = new TrackedObject({
      isLoading: true,
      load: async () => {
        state.isLoading = true;
        try {
          if (stubbedGasTokens) {
            state.value = stubbedGasTokens;
          } else {
            let gasTokens = await fetchSupportedGasTokens(chainId);
            const { transactionTokens } = this;
            gasTokens = gasTokens.map(
              (gt) =>
                transactionTokens.find((tt) => tt.address === gt.address) || gt
            );
            state.value = gasTokens;
          }
        } catch (error) {
          state.error = error;
        } finally {
          state.isLoading = false;
        }
      },
    });

    state.load();
    return state;
  });

  get transactionTokens(): TokenDetail[] {
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

  _stubbedTransactionTokens: TokenDetail[] | undefined;
  @tracked _stubbedGasTokens: TokenDetail[] | undefined;

  stubGasTokens(val: TokenDetail[]) {
    this._stubbedGasTokens = val;
  }

  stubTransactionTokens(val: TokenDetail[]) {
    this._stubbedTransactionTokens = val;
  }

  async tokenFromAddress(
    address: ChainAddress
  ): Promise<TokenDetail | undefined> {
    if (!this.gasTokens.value || this.gasTokens.isLoading) {
      await this.gasTokens.load();
    }
    return [
      ...this.transactionTokens,
      ...(this.gasTokens.value as TokenDetail[]),
    ].find((t) => t.address === address);
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    tokens: TokensService;
  }
}
