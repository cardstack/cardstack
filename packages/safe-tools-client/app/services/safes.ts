import {
  getSafesWithSpModuleEnabled,
  Web3Provider,
  getTokenBalancesForSafe,
  getConstantByNetwork,
  TokenDetail,
} from '@cardstack/cardpay-sdk';
import NetworkService from '@cardstack/safe-tools-client/services/network';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import { action } from '@ember/object';
import Service, { inject as service } from '@ember/service';
import { isTesting } from '@embroider/macros';
import { tracked } from '@glimmer/tracking';
import { TaskGenerator, rawTimeout } from 'ember-concurrency';
import { task } from 'ember-concurrency-decorators';
import { taskFor } from 'ember-concurrency-ts';
import { use, resource } from 'ember-resources';
import { BigNumber } from 'ethers';
import { TrackedObject } from 'tracked-built-ins';

const RELOAD_BALANCES_INTERVAL = isTesting() ? 500 : 30 * 1000; // Every 30 seconds

export interface Safe {
  address: string;
  spModuleAddress: string;
}

export interface TokenBalance {
  symbol: string;
  balance: BigNumber;
  decimals: number;
  isNativeToken?: boolean;
}

interface SafeResourceState extends Record<PropertyKey, unknown> {
  error?: Error;
  isLoading?: boolean;
  value?: Safe[];
  load: () => Promise<void>;
}

interface TokenBalanceResourceState extends Record<PropertyKey, unknown> {
  error?: Error;
  isLoading: boolean;
  value?: TokenBalance[];
  load: () => Promise<void>;
}

export default class SafesService extends Service {
  @service declare network: NetworkService;
  @service declare wallet: WalletService;

  @tracked selectedSafe?: Safe;

  constructor(properties?: object | undefined) {
    super(properties);

    // We keep reloading the token balances so that they are up do date
    // when users add or remove funds in the safe independently of the app
    taskFor(this.refreshTokenBalancesIndefinitely).perform();
  }

  @task *refreshTokenBalancesIndefinitely(): TaskGenerator<void> {
    while (true) {
      yield this.reloadTokenBalances();
      yield rawTimeout(RELOAD_BALANCES_INTERVAL);
    }
  }

  get safes(): Safe[] | undefined {
    return this.safesResource.value;
  }

  get isLoadingSafes(): boolean | undefined {
    return this.safesResource.isLoading;
  }

  lastTokenBalances: TokenBalance[] | undefined;

  get tokenBalances(): TokenBalance[] | undefined {
    return this.tokenBalancesResource.value;
  }

  get isLoadingTokenBalances(): boolean {
    return this.tokenBalancesResource.isLoading;
  }

  get currentSafe(): Safe | undefined {
    return this.selectedSafe || this.safes?.[0];
  }

  @action onSelectSafe(safe: Safe) {
    this.selectedSafe = safe;
  }

  async reloadTokenBalances() {
    await this.tokenBalancesResource.load();
  }

  @use tokenBalancesResource = resource(() => {
    if (!this.wallet.ethersProvider || !this.currentSafe) {
      return new TrackedObject({
        error: false,
        isLoading: false,
        value: [],
        load: () => Promise<void>,
      });
    }

    const state: TokenBalanceResourceState = new TrackedObject({
      isLoading: true,
      value: this.lastTokenBalances || [],
      error: undefined,
      load: async () => {
        state.isLoading = true;

        const tokenAddresses = getConstantByNetwork(
          'tokenList',
          this.network.symbol
        ).tokens.map((t: TokenDetail) => t.address);

        try {
          if (!this.currentSafe) return;

          state.value = await this.fetchTokenBalances(
            this.currentSafe.address,
            tokenAddresses,
            this.wallet.ethersProvider
          );
          this.lastTokenBalances = state.value;
        } catch (error) {
          console.log(error);
          state.error = error;
        } finally {
          state.isLoading = false;
        }
      },
    });

    state.load();
    return state;
  });

  @use safesResource = resource(() => {
    // because networkInfo is tracked, anytime the network switches,
    // this resource will re-run
    const chainId = this.network.networkInfo.chainId;
    const address = this.wallet.address;

    const state: SafeResourceState = new TrackedObject({
      error: undefined,

      load: async () => {
        if (!address) return;

        state.isLoading = true;

        try {
          state.value = await this.fetchSafes(chainId, address);
        } catch (error) {
          state.error = new Error(
            'There was an error while fetching your safes. Try switching to this network again, or contact support if the problem persists.'
          );
          throw error;
        } finally {
          state.isLoading = false;
        }
      },
    });

    state.load();
    return state;
  });

  async fetchTokenBalances(
    safeAddress: string,
    tokenAddresses: string[],
    provider: Web3Provider
  ): Promise<TokenBalance[]> {
    const nativeTokenBalance = await provider.getBalance(safeAddress);

    const tokenBalances = await getTokenBalancesForSafe(
      provider,
      tokenAddresses,
      safeAddress
    );

    return [
      {
        symbol: getConstantByNetwork('nativeTokenSymbol', this.network.symbol),
        balance: nativeTokenBalance,
        decimals: 18,
        isNativeToken: true,
      },
      ...tokenBalances,
    ];
  }

  // Wrapped in a method for stubbing in tests
  async fetchSafes(chainId: number, address: string) {
    return getSafesWithSpModuleEnabled(chainId, address);
  }
}
