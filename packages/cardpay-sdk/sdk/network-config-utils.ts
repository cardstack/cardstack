import { supportedChains, Network, networks, supportedChainsArray } from './constants';
import { HubConfigResponse, RpcNodeUrl } from './hub-config';

type Networkish = string | number | Network;

const convertChainIdToName = (network: Networkish) => (typeof network === 'number' ? networks[network] : network);

export const getWeb3ConfigByNetwork = (config: HubConfigResponse, network: Networkish): RpcNodeUrl => {
  const networkName = convertChainIdToName(network);

  if (supportedChains.ethereum.includes(networkName)) return config.web3.ethereum;
  if (supportedChains.gnosis.includes(networkName)) return config.web3.gnosis;
  if (supportedChains.polygon.includes(networkName)) return config.web3.polygon;

  throw new Error(`Unsupported network: ${network}`);
};

export const isSupportedChain = (network: Networkish) => supportedChainsArray.includes(convertChainIdToName(network));
