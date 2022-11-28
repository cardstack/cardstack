import {
  getConstantByNetwork,
  Network,
  networks,
  schedulerSupportedChainsArray,
  SchedulerCapableNetworks,
} from '@cardstack/cardpay-sdk';
import { getOwner } from '@ember/application';
import { action } from '@ember/object';
import Service from '@ember/service';
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
    return schedulerSupportedChainsArray
      .map((networkSymbol) => ({
        name: getConstantByNetwork('name', networkSymbol),
        chainId: getConstantByNetwork('chainId', networkSymbol),
        symbol: networkSymbol,
      }))
      .filter(({ name }) => name !== this.name);
  }
  @action onSelect(networkInfo: NetworkInfo) {
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
