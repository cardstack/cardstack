import Service from '@ember/service';

import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

import {
  getConstantByNetwork,
  Networks,
  networks,
  supportedChainsArray,
} from '@cardstack/cardpay-sdk';

const DEFAULT_NETWORK = 'mainnet' as const; // TODO: add default based on env

export default class Network extends Service {
  @tracked chainId = getConstantByNetwork('chainId', DEFAULT_NETWORK);
  @tracked name = getConstantByNetwork('name', DEFAULT_NETWORK);
  @tracked symbol: Networks = DEFAULT_NETWORK;

  get supportedList() {
    return supportedChainsArray
      .map((networkSymbol) => ({
        name: getConstantByNetwork('name', networkSymbol),
        chainId: getConstantByNetwork('chainId', networkSymbol),
        symbol: networkSymbol,
      }))
      .filter(({ name }) => name !== this.name);
  }

  @action onSelect({ chainId, symbol, name }: Network) {
    this.name = name;
    this.symbol = symbol;
    this.chainId = chainId;
  }

  @action onChainChanged(chainId: number) {
    const symbol = networks[chainId];
    const name = getConstantByNetwork('name', symbol);

    this.onSelect({ chainId, symbol, name } as Network);
  }
}

declare module '@ember/service' {
  interface Registry {
    network: Network;
  }
}
