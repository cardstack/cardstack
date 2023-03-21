/*global fetch */

import { getConstant, supportedChains, Network, networks, supportedChainsArray } from './constants';
import { HubConfigResponse, RpcNodeUrl } from './hub-config';

/**
 * @group Utils
 * @category Network Config
 */
export type Networkish = string | number | Network;

/**
 * @group Utils
 * @category Network Config
 */
export const convertChainIdToName = (network: Networkish) =>
  typeof network === 'number' ? networks[network] : network;

/**
 * @group Utils
 * @category Network Config
 */
export const getWeb3ConfigByNetwork = (config: HubConfigResponse, network: Networkish): RpcNodeUrl => {
  const networkName = convertChainIdToName(network);

  if (supportedChains.ethereum.includes(networkName)) return config.web3.ethereum;
  if (supportedChains.gnosis.includes(networkName)) return config.web3.gnosis;
  if (supportedChains.polygon.includes(networkName)) return config.web3.polygon;

  throw new Error(`Unsupported network: ${network}`);
};

/**
 * @group Utils
 * @category Network Config
 */
export const isSupportedChain = (network: Networkish) => supportedChainsArray.includes(convertChainIdToName(network));

/**
 * @group Utils
 * @category Network Config
 */
export const isCardPaySupportedNetwork = (network: Network | string) => supportedChains.gnosis.includes(network);

/**
 * @group Utils
 * @category Network Config
 */
export interface TokenDetail {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}

interface RelayServerTokensResponse {
  count: number;
  next: null | string;
  previous: null | string;
  results: {
    address: string;
    logoUri: string;
    default: boolean;
    name: string;
    symbol: string;
    description: string;
    decimals: number;
    websiteUri: string;
    gas: boolean;
  }[];
}

/**
 * @group Utils
 * @category Network Config
 */
export const fetchSupportedGasTokens = async (network: Networkish): Promise<TokenDetail[]> => {
  const networkName = convertChainIdToName(network);
  let relayServiceURL = await getConstant('relayServiceURL', networkName);
  let url = `${relayServiceURL}/v1/tokens/?gas=true`;
  let options = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  };
  let response = await fetch(url, options);
  if (!response?.ok) {
    throw new Error(await response.text());
  }
  let resultJSON: RelayServerTokensResponse = await response.json();
  return resultJSON.results.map((result) => {
    let { address, name, symbol, decimals } = result;
    return { address, name, symbol, decimals };
  });
};
