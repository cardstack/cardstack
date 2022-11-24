import {
  getConstantByNetwork,
  Network,
  networks,
  schedulerSupportedChainsArray,
  SchedulerCapableNetworks,
} from '@cardstack/cardpay-sdk';
import { action } from '@ember/object';
import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';

interface NetworkInfo {
  chainId: number;
  name: string;
  symbol: Network;
}
const DEFAULT_NETWORK = 'mainnet' as const; // TODO: add default based on env

export default class NetworkService extends Service {
  @tracked networkInfo: NetworkInfo = {
    chainId: getConstantByNetwork('chainId', DEFAULT_NETWORK),
    name: getConstantByNetwork('name', DEFAULT_NETWORK),
    symbol: DEFAULT_NETWORK,
  };

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
