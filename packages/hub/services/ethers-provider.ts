import config from 'config';
import { convertChainIdToName, getWeb3ConfigByNetwork, JsonRpcProvider } from '@cardstack/cardpay-sdk';

export default class EthersProvider {
  getInstance(chainId: number) {
    let rpcUrl = getWeb3ConfigByNetwork({ web3: config.get('web3') }, chainId).rpcNodeHttpsUrl;

    // For some networks, we want to use a private RPC node (to increase reliability), and not the one
    // that is configured in the web3 config, because that one is public and may be unreliable
    let networkName = convertChainIdToName(chainId);
    let hubRpcNodeKey = `hubRpcNodes.${networkName}.rpcNodeHttpsUrl`;
    if (config.has(hubRpcNodeKey)) {
      let hubRpcUrl: string | null = config.get(hubRpcNodeKey);

      if (hubRpcUrl) {
        rpcUrl = hubRpcUrl;
      }
    }

    return new JsonRpcProvider(rpcUrl, chainId);
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'ethers-provider': EthersProvider;
  }
}
