import Web3 from 'web3';
import invert from 'lodash/invert';
import { networkName } from './utils/general-utils';
import JsonRpcProvider from '../providers/json-rpc-provider';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const MERCHANT_PAYMENT_UNIVERSAL_LINK_HOSTNAME = 'wallet.cardstack.com';
export const MERCHANT_PAYMENT_UNIVERSAL_LINK_STAGING_HOSTNAME = 'wallet-staging.stack.cards';
export const CARDWALLET_SCHEME = 'cardwallet';

type NestedKeyOf<Obj extends object> = {
  [K in keyof Obj]: Obj[K] extends object ? NestedKeyOf<Obj[K]> : K;
}[keyof Obj];

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
    scheduledPaymentFeeFixedUSD: 0,
    scheduledPaymentFeePercentage: 0
  },
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
  },
  goerli: {
    ...testHubUrl,
    ...ethNativeTokens,
    apiBaseUrl: 'https://api-goerli.etherscan.io/api',
    blockExplorer: 'https://goerli.etherscan.io',
    name: 'Goerli',
    relayServiceURL: 'https://relay-goerli.staging.stack.cards/api',
    chainId: 5,
    scheduledPaymentFeeFixedUSD: 0,
    scheduledPaymentFeePercentage: 0
  },
  polygon: {
    ...hubUrl,
    ...polygonNativeTokens,
    apiBaseUrl: 'https://api-testnet.polygon.io/api', // TODO: add official polygon api
    blockExplorer: 'https://polygonscan.com',
    name: 'Polygon',
    chainId: 137,
    scheduledPaymentFeeFixedUSD: 0.25,
    scheduledPaymentFeePercentage: 0.1 //10%
  },
  mumbai: {
    ...testHubUrl,
    ...polygonNativeTokens,
    apiBaseUrl: 'https://api-testnet.polygon.io/api',
    blockExplorer: 'https://mumbai.polygonscan.com',
    name: 'Mumbai',
    relayServiceURL: 'https://relay-mumbai.staging.stack.cards/api',
    chainId: 80001,
    scheduledPaymentFeeFixedUSD: 0,
    scheduledPaymentFeePercentage: 0
  },
  mainnet: {
    ...hubUrl,
    ...ethNativeTokens,
    apiBaseUrl: 'https://api.etherscan.io/api',
    blockExplorer: 'https://etherscan.io',
    bridgeExplorer: 'https://alm-xdai.herokuapp.com/1',
    name: 'Ethereum Mainnet',
    // check https://docs.tokenbridge.net/eth-xdai-amb-bridge/about-the-eth-xdai-amb for the finalization rate
    ambFinalizationRate: '20',
    relayServiceURL: 'https://relay-ethereum.cardstack.com/api',
    chainId: 1,
    scheduledPaymentFeeFixedUSD: 0.25,
    scheduledPaymentFeePercentage: 0.1 //10%
  },
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
    scheduledPaymentFeeFixedUSD: 0.25,
    scheduledPaymentFeePercentage: 0.1 //10%
  },
};

type NetworksType = typeof networksConstants;

export type Network = keyof NetworksType | 'xdai';

type ConstantKeys = NestedKeyOf<NetworksType>;

// TODO: create types dynamically
type OptionalNetworkContants = Partial<
  NetworksType['sokol'] &
    NetworksType['gnosis'] &
    NetworksType['goerli'] &
    NetworksType['polygon'] &
    NetworksType['mainnet'] &
    NetworksType['kovan'] &
    NetworksType['mumbai']
>;

interface RequiredNetworkConstants {
  name: string;
  chainId: number;
  hubUrl: string;
  nativeTokenSymbol: string;
}

type NetworkContants = OptionalNetworkContants & RequiredNetworkConstants;

// Order matters, if both have same chainId the last one is used.
const constants: Record<Network, NetworkContants> = {
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
export const networks = invert(networkIds);

export function getConstantByNetwork<K extends ConstantKeys>(name: K, network: Network | string) {
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
