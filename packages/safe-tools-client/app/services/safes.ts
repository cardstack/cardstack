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
import { BN } from 'bn.js';
import { use, resource } from 'ember-resources';
import { TrackedObject } from 'tracked-built-ins';

export interface Safe {
  address: string;
  spModuleAddress: string;
}

export interface TokenBalance {
  symbol: string;
  balance: typeof BN;
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

  get tokenBalances(): TokenBalance[] | undefined {
    return this.tokenBalancesResource.value;
  }

  get currentSafe(): Safe | undefined {
    return this.selectedSafe || this.safes?.[0];
  }

  @action onSelectSafe(safe: Safe) {
    this.selectedSafe = safe;
  }

  @use tokenBalancesResource = resource(() => {
    if (!this.wallet.web3.currentProvider || !this.currentSafe) {
      return {
        error: false,
        isLoading: false,
        value: [],
      };
    }

    const state: TokenBalanceResourceState = new TrackedObject({
      isLoading: true,
    });

    //@ts-expect-error currentProvider does not match Web3Provider,
    //not worth typing as we should replace the web3 one with ethers soon
    const ethersProvider = new Web3Provider(this.wallet.web3.currentProvider);

    const tokenAddresses = getConstantByNetwork(
      'tokenList',
      this.network.symbol
    ).tokens.map((t: SelectableToken) => t.address);

    (async () => {
      try {
        if (!this.currentSafe) return;
        const nativeTokenBalance = new BN(
          (await ethersProvider.getBalance(this.currentSafe.address)).toString()
        );

        const tokenBalances = await getTokenBalancesForSafe(
          ethersProvider,
          tokenAddresses,
          this.currentSafe.address
        );

        state.value = [
          {
            symbol: getConstantByNetwork(
              'nativeTokenSymbol',
              this.network.symbol
            ),
            balance: nativeTokenBalance as unknown as typeof BN,
            decimals: 18,
            isNativeToken: true,
          },
          ...tokenBalances,
        ];
      } catch (error) {
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
      load: async () => {
        if (!address) return;

        state.isLoading = true;

        try {
          state.value = await getSafesWithSpModuleEnabled(chainId, address);
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
}
