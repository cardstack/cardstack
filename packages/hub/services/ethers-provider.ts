import config from 'config';
import { convertChainIdToName, getWeb3ConfigByNetwork, JsonRpcProvider } from '@cardstack/cardpay-sdk';

export default class EthersProvider {
  getInstance(chainId: number) {
    let rpcUrl: string;

    // For some networks, we want to use a private RPC node (to increase reliability), and not the one
    // that is configured in the web3 config, because that one is public and may be unreliable

    let networkName = convertChainIdToName(chainId);
    let hubRpcNodeKey = `hubRpcNodes.${networkName}.rpcNodeHttpsUrl`;
    if (config.has(hubRpcNodeKey)) {
      rpcUrl = config.get(hubRpcNodeKey);
    } else {
      rpcUrl = getWeb3ConfigByNetwork({ web3: config.get('web3') }, chainId).rpcNodeHttpsUrl;
    }

    return new JsonRpcProvider(rpcUrl, chainId);
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'ethers-provider': EthersProvider;
  }
}
