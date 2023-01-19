import {
  getConstantByNetwork,
  Network,
  SchedulerCapableNetworks,
  supportedChainsArray,
} from '@cardstack/cardpay-sdk';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import { getOwner } from '@ember/application';
import { action } from '@ember/object';
import Service, { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

import HubConfigService from './hub-config';

interface NetworkInfo {
  chainId: number;
  name: string;
  symbol: Network;
}

const DEFAULT_NETWORK = 'mainnet' as const; // TODO: add default based on env
const LOCALSTORAGE_NETWORK_KEY = 'cardstack-cached-network';

export default class NetworkService extends Service {
  storage: Storage;

  @service declare wallet: WalletService;
  @service declare hubConfig: HubConfigService;

  @tracked networkInfo: NetworkInfo;

  constructor(properties?: object | undefined) {
    super(properties);
    const owner = getOwner(this);

    this.storage =
      (owner.lookup('storage:local') as Storage) || window.localStorage;

    const cachedNetwork = this.storage.getItem(LOCALSTORAGE_NETWORK_KEY);

    const networkName: Network = cachedNetwork?.length
      ? (cachedNetwork as Network)
      : DEFAULT_NETWORK;

    this.networkInfo = {
      chainId: getConstantByNetwork('chainId', networkName),
      name: getConstantByNetwork('name', networkName),
      symbol: networkName,
    };
  }

  get supportedNetworks() {
    // Initially return all the scheduler-capable networks the SDK supports, and then
    // narrow it down after retrieving the networks supported by the hub.
    const allSupportedNetworks = supportedChainsArray.map((networkSymbol) => ({
      name: getConstantByNetwork('name', networkSymbol),
      chainId: getConstantByNetwork('chainId', networkSymbol),
      symbol: networkSymbol as Network,
    }));
    const remoteConfigState = this.hubConfig.remoteConfig;
    const remoteConfig = remoteConfigState.value;
    if (!remoteConfig) {
      return allSupportedNetworks;
    }
    const hubSchedulerNetworkSymbols = remoteConfig.web3.schedulerNetworks;
    const hubSupportedNetworks = allSupportedNetworks.filter((network) =>
      hubSchedulerNetworkSymbols.includes(network.symbol)
    );
    return hubSupportedNetworks;
  }

  isSupportedNetwork(chainId: number): boolean {
    return this.supportedNetworks.some(
      (n: NetworkInfo) => n.chainId === chainId
    );
  }

  @action async onSelect(networkInfo: NetworkInfo) {
    await this.wallet.switchNetwork(networkInfo.chainId);

    if (this.networkInfo.chainId === networkInfo.chainId) return;

    this.networkInfo = networkInfo;
    this.storage.setItem(LOCALSTORAGE_NETWORK_KEY, networkInfo.symbol);
  }

  @action onChainChanged(chainId: number) {
    const networkInfo = this.supportedNetworks.find(
      (n: NetworkInfo) => n.chainId === chainId
    );
    if (networkInfo) {
      this.onSelect(networkInfo);
    } else {
      throw new Error(`Unsupported network: ${networkInfo}`);
    }
  }

  get chainId() {
    return this.networkInfo.chainId;
  }
  get name() {
    return this.networkInfo.name;
  }
  get symbol(): SchedulerCapableNetworks {
    return this.networkInfo.symbol as SchedulerCapableNetworks;
  }
}

declare module '@ember/service' {
  interface Registry {
    network: NetworkService;
  }
}
