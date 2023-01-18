import { SelectableToken } from '@cardstack/boxel/components/boxel/input/selectable-token';
import {
  getSafesWithSpModuleEnabled,
  Web3Provider,
  getTokenBalancesForSafe,
  getConstantByNetwork,
} from '@cardstack/cardpay-sdk';
import NetworkService from '@cardstack/safe-tools-client/services/network';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import { action } from '@ember/object';
import Service, { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { use, resource } from 'ember-resources';
import { BigNumber } from 'ethers';
import { TrackedObject } from 'tracked-built-ins';

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
}

export default class SafesService extends Service {
  @service declare network: NetworkService;
  @service declare wallet: WalletService;

  @tracked selectedSafe?: Safe;

  get safes(): Safe[] | undefined {
    return this.safesResource.value;
  }

  get isLoadingSafes(): boolean | undefined {
    return this.safesResource.isLoading;
  }

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

  @use tokenBalancesResource = resource(() => {
    if (!this.wallet.ethersProvider || !this.currentSafe) {
      return {
        error: false,
        isLoading: false,
        value: [],
      };
    }

    const state: TokenBalanceResourceState = new TrackedObject({
      isLoading: true,
    });

    const tokenAddresses = getConstantByNetwork(
      'tokenList',
      this.network.symbol
    ).tokens.map((t: SelectableToken) => t.address);

    (async () => {
      try {
        if (!this.currentSafe) return;

        state.value = await this.fetchTokenBalances(
          this.currentSafe.address,
          tokenAddresses,
          this.wallet.ethersProvider
        );
      } catch (error) {
        console.log(error);
        state.error = error;
      } finally {
        state.isLoading = false;
      }
    })();

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
