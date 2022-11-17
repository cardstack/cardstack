import Web3 from 'web3';
import invert from 'lodash/invert';
import { networkName } from './utils/general-utils';
import JsonRpcProvider from '../providers/json-rpc-provider';
import ethTokenList from '../token-lists/ethereum-tokenlist.json';
import goerliTokenList from '../token-lists/goerli-tokenlist.json';
import mumbaiTokenList from '../token-lists/mumbai-tokenlist.json';
import polygonTokenList from '../token-lists/polygon-tokenlist.json';
import { type TokenList } from '@uniswap/token-lists';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const MERCHANT_PAYMENT_UNIVERSAL_LINK_HOSTNAME = 'wallet.cardstack.com';
export const MERCHANT_PAYMENT_UNIVERSAL_LINK_STAGING_HOSTNAME = 'wallet-staging.stack.cards';
export const CARDWALLET_SCHEME = 'cardwallet';

export const supportedChains = {
  ethereum: ['mainnet', 'goerli'],
  gnosis: ['gnosis', 'sokol'],
  polygon: ['polygon', 'mumbai'],
};

export const supportedChainsArray = Object.values(supportedChains).flat();

const testHubUrl = {
  hubUrl: 'https://hub-staging.stack.cards',
};

const hubUrl = {
  hubUrl: 'https://hub.cardstack.com',
};

const ethNativeTokens = {
  nativeTokenCoingeckoId: 'ethereum',
  nativeTokenAddress: 'eth',
  nativeTokenSymbol: 'ETH',
  nativeTokenName: 'Ethereum',
};

const bridgedTokens = {
  bridgedDaiTokenSymbol: 'DAI.CPXD',
  bridgedCardTokenSymbol: 'CARD.CPXD',
};

const polygonNativeTokens = {
  nativeTokenAddress: 'matic',
  nativeTokenCoingeckoId: 'polygon',
  nativeTokenSymbol: 'MATIC',
  nativeTokenName: 'Matic',
};

interface RequiredNetworkConstants {
  apiBaseUrl: string;
  blockExplorer: string;
  chainId: number;
  hubUrl: string;
  name: string;
  nativeTokenAddress: string;
  nativeTokenCoingeckoId: string;
  nativeTokenName: string;
  nativeTokenSymbol: string;
}

interface SchedulerCapableNetworkConstants {
  tokenList: TokenList;
  relayServiceURL: string;
  scheduledPaymentFeeFixedUSD: number;
  scheduledPaymentFeePercentage: number;
  subgraphURL: string;
}

type SokolNetworkConstants = RequiredNetworkConstants & {
  bridgedDaiTokenSymbol: string;
  bridgedCardTokenSymbol: string;
  bridgeExplorer: string;
  merchantUniLinkDomain: string;
  relayServiceURL: string;
  subgraphURL: string;
};

type KovanNetworkConstants = RequiredNetworkConstants & {
  bridgeExplorer: string;
  // https://docs.tokenbridge.net/kovan-sokol-amb-bridge/about-the-kovan-sokol-amb shows 1 for finalization rate
  // but making this the same as mainnet so that the dev experience matches prod
  ambFinalizationRate: string;
  subgraphURL: string;
};

type GoerliNetworkConstants = RequiredNetworkConstants & SchedulerCapableNetworkConstants;

type PolygonNetworkConstants = RequiredNetworkConstants & SchedulerCapableNetworkConstants;

type MainnetNetworkConstants = RequiredNetworkConstants &
  SchedulerCapableNetworkConstants & {
    bridgeExplorer: string;
    ambFinalizationRate: string;
  };

type GnosisNetworkConstants = RequiredNetworkConstants & {
  bridgedDaiTokenSymbol: string;
  bridgedCardTokenSymbol: string;
  bridgeExplorer: string;
  relayServiceURL: string;
  tallyServiceURL: string;
  merchantUniLinkDomain: string;
};

const networksConstants = {
  sokol: {
    ...testHubUrl,
    ...ethNativeTokens,
    ...bridgedTokens,
    apiBaseUrl: 'https://blockscout.com/poa/sokol/api/eth-rpc',
    blockExplorer: 'https://blockscout.com/poa/sokol',
    bridgeExplorer: 'https://alm-test-amb.herokuapp.com/77',
    nativeTokenAddress: 'spoa',
    nativeTokenSymbol: 'SPOA',
    nativeTokenName: 'SPOA',
    name: 'Sokol',
    relayServiceURL: 'https://relay-staging.stack.cards/api',
    subgraphURL: 'https://graph-staging.stack.cards/subgraphs/name/habdelra/cardpay-sokol',
    merchantUniLinkDomain: MERCHANT_PAYMENT_UNIVERSAL_LINK_STAGING_HOSTNAME,
    tallyServiceURL: 'https://reward-api-staging.stack.cards',
    chainId: 77,
  } as SokolNetworkConstants,
  kovan: {
    ...testHubUrl,
    ...ethNativeTokens,
    apiBaseUrl: 'https://api-kovan.etherscan.io/api',
    blockExplorer: 'https://kovan.etherscan.io',
    bridgeExplorer: 'https://alm-test-amb.herokuapp.com/42',
    name: 'Kovan',
    // https://docs.tokenbridge.net/kovan-sokol-amb-bridge/about-the-kovan-sokol-amb shows 1 for finalization rate
    // but making this the same as mainnet so that the dev experience matches prod
    ambFinalizationRate: '20',
    subgraphURL: '',
    chainId: 42,
  } as KovanNetworkConstants,
  goerli: {
    ...testHubUrl,
    ...ethNativeTokens,
    tokenList: goerliTokenList as unknown as TokenList,
    apiBaseUrl: 'https://api-goerli.etherscan.io/api',
    blockExplorer: 'https://goerli.etherscan.io',
    name: 'Goerli',
    relayServiceURL: 'https://relay-goerli.staging.stack.cards/api',
    chainId: 5,
    scheduledPaymentFeeFixedUSD: 0,
    scheduledPaymentFeePercentage: 0,
    subgraphURL: 'https://api.thegraph.com/subgraphs/name/cardstack/safe-tools-goerli',
  } as GoerliNetworkConstants,
  polygon: {
    ...hubUrl,
    ...polygonNativeTokens,
    tokenList: polygonTokenList as unknown as TokenList,
    apiBaseUrl: 'https://api-testnet.polygon.io/api', // TODO: add official polygon api
    blockExplorer: 'https://polygonscan.com',
    name: 'Polygon',
    chainId: 137,
    scheduledPaymentFeeFixedUSD: 0.25,
    scheduledPaymentFeePercentage: 0.1, //10%
  } as PolygonNetworkConstants,
  mumbai: {
    ...testHubUrl,
    ...polygonNativeTokens,
    tokenList: mumbaiTokenList as unknown as TokenList,
    apiBaseUrl: 'https://api-testnet.polygon.io/api',
    blockExplorer: 'https://mumbai.polygonscan.com',
    name: 'Mumbai',
    relayServiceURL: 'https://relay-mumbai.staging.stack.cards/api',
    chainId: 80001,
    scheduledPaymentFeeFixedUSD: 0,
    scheduledPaymentFeePercentage: 0,
    subgraphURL: 'https://api.thegraph.com/subgraphs/name/cardstack/safe-tools-mumbai',
  } as PolygonNetworkConstants,
  mainnet: {
    ...hubUrl,
    ...ethNativeTokens,
    tokenList: ethTokenList as unknown as TokenList,
    apiBaseUrl: 'https://api.etherscan.io/api',
    blockExplorer: 'https://etherscan.io',
    bridgeExplorer: 'https://alm-xdai.herokuapp.com/1',
    name: 'Ethereum Mainnet',
    // check https://docs.tokenbridge.net/eth-xdai-amb-bridge/about-the-eth-xdai-amb for the finalization rate
    ambFinalizationRate: '20',
    relayServiceURL: 'https://relay-ethereum.cardstack.com/api',
    chainId: 1,
    scheduledPaymentFeeFixedUSD: 0.25,
    scheduledPaymentFeePercentage: 0.1, //10%
  } as MainnetNetworkConstants,
  gnosis: {
    ...hubUrl,
    ...bridgedTokens,
    apiBaseUrl: 'https://blockscout.com/xdai/mainnet/api',
    blockExplorer: 'https://blockscout.com/xdai/mainnet',
    bridgeExplorer: 'https://alm-xdai.herokuapp.com/100',
    nativeTokenAddress: 'xdai',
    nativeTokenCoingeckoId: 'xdai',
    nativeTokenSymbol: 'XDAI',
    nativeTokenName: 'xDai',
    name: 'Gnosis Chain',
    relayServiceURL: 'https://relay.cardstack.com/api',
    subgraphURL: 'https://graph.cardstack.com/subgraphs/name/habdelra/cardpay-xdai',
    merchantUniLinkDomain: MERCHANT_PAYMENT_UNIVERSAL_LINK_HOSTNAME,
    tallyServiceURL: 'https://reward-api.cardstack.com',
    chainId: 100,
  } as GnosisNetworkConstants,
};

type NetworksType = typeof networksConstants;

export type Network = keyof NetworksType | 'xdai';

type NetworkConstants = RequiredNetworkConstants &
  Partial<
    SokolNetworkConstants &
      KovanNetworkConstants &
      GoerliNetworkConstants &
      PolygonNetworkConstants &
      MainnetNetworkConstants &
      GnosisNetworkConstants
  >;

type ConstantKeys = keyof NetworkConstants;

// Order matters, if both have same chainId the last one is used.
const constants: Record<Network, NetworkConstants> = {
  xdai: networksConstants['gnosis'],
  ...networksConstants,
} as const;

export const networkNames = Object.keys(constants);

export const networkIds: Record<string, number> = Object.freeze(
  networkNames.reduce(
    (netIds, networkName) => ({
      ...netIds,
      [networkName]: constants[networkName as Network].chainId,
    }),
    {}
  )
);

// invert the networkIds object, so { mainnet: 1, ... } becomes { '1': 'mainnet', ... }
export const networks: Record<string, string> = invert(networkIds);

export function getConstantByNetwork<K extends ConstantKeys>(name: K, network: Network | string | number) {
  //Convert chain id to network name
  if (typeof network === 'number') {
    network = networks[network];
  }

  let value = constants[network as Network][name];
  if (!value) {
    throw new Error(`Don't know about the constant '${name}' for network ${network}`);
  }
  return value;
}

export async function getConstant<K extends ConstantKeys>(
  name: K,
  web3OrNetworkOrEthersProvider: Web3 | string | JsonRpcProvider
) {
  let network: string;
  if (typeof web3OrNetworkOrEthersProvider === 'string') {
    network = web3OrNetworkOrEthersProvider;
  } else {
    network = await networkName(web3OrNetworkOrEthersProvider);
  }

  let value = constants[network as Network][name];
  if (value == undefined) {
    throw new Error(`Don't know about the constant '${name}' for network ${network}`);
  }
  return value;
}

export default constants;
