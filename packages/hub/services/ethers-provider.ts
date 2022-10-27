import config from 'config';
import { NotFound } from '@cardstack/core/src/utils/errors';
import { JsonRpcProvider } from '@cardstack/cardpay-sdk';

export let supportedChains = [
  {
    id: 1,
    name: 'ethereum',
    rpcUrl: config.get('web3.ethereum.rpcNodeHttpsUrl'),
  },
  {
    id: 5,
    name: 'goerli',
    rpcUrl: config.get('web3.ethereum.rpcNodeHttpsUrl'),
  },
  {
    id: 100,
    name: 'gnosis',
    rpcUrl: config.get('web3.gnosis.rpcNodeHttpsUrl'),
  },
  {
    id: 77,
    name: 'sokol',
    rpcUrl: config.get('web3.gnosis.rpcNodeHttpsUrl'),
  },
  {
    id: 137,
    name: 'polygon',
    rpcUrl: config.get('web3.polygon.rpcNodeHttpsUrl'),
  },
  {
    id: 80001,
    name: 'mumbai',
    rpcUrl: config.get('web3.polygon.rpcNodeHttpsUrl'),
  },
];

export default class EthersProvider {
  getInstance(chainId: number) {
    let rpcUrl = supportedChains.find((chain) => chain.id === chainId)?.rpcUrl as string;
    if (!rpcUrl) {
      throw new NotFound(`chain id is not supported`);
    }
    return new JsonRpcProvider(rpcUrl, chainId);
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'ethers-provider': EthersProvider;
  }
}
