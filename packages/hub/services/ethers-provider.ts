import config from 'config';
import { getWeb3ConfigByNetwork, JsonRpcProvider } from '@cardstack/cardpay-sdk';

export default class EthersProvider {
  getInstance(chainId: number) {
    let rpcUrl = getWeb3ConfigByNetwork({ web3: config.get('web3') }, chainId).rpcNodeHttpsUrl;
    return new JsonRpcProvider(rpcUrl, chainId);
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'ethers-provider': EthersProvider;
  }
}
