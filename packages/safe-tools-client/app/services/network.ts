import {
  getConstantByNetwork,
  Network,
  networks,
  SchedulerCapableNetworks,
  supportedChainsArray,
} from '@cardstack/cardpay-sdk';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import { getOwner } from '@ember/application';
import { action } from '@ember/object';
import Service, { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

interface NetworkInfo {
  chainId: number;
  name: string;
  symbol: Network;
}
const DEFAULT_NETWORK = 'mainnet' as const; // TODO: add default based on env
const LOCALSTORAGE_NETWORK_KEY = 'cardstack-cached-network';

export default class NetworkService extends Service {
  storage: Storage;

  // @ts-expect-error "Property 'wallet' has no initializer and is not definitely assigned in the constructor" - ignore this error because Ember will inject the service
  @service wallet: WalletService;

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

  get supportedList() {
    return supportedChainsArray
      .map((networkSymbol) => ({
        name: getConstantByNetwork('name', networkSymbol),
        chainId: getConstantByNetwork('chainId', networkSymbol),
        symbol: networkSymbol,
      }))
      .filter(({ name }) => name !== this.name);
  }

  @action async onSelect(networkInfo: NetworkInfo) {
    await this.wallet.switchNetwork(networkInfo.chainId);

    if (this.networkInfo.chainId === networkInfo.chainId) return;

    this.networkInfo = networkInfo;
    this.storage.setItem(LOCALSTORAGE_NETWORK_KEY, networkInfo.symbol);
  }

  @action onChainChanged(chainId: number) {
    const symbol = networks[chainId];
    const name = getConstantByNetwork('name', symbol);

    this.onSelect({ chainId, symbol, name } as NetworkInfo);
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
