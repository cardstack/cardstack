import Web3 from 'web3';
import invert from 'lodash/invert';
import { networkName } from './utils/general-utils';
import JsonRpcProvider from '../providers/json-rpc-provider';
import ethTokenList from '../token-lists/ethereum-tokenlist.json';
import goerliTokenList from '../token-lists/goerli-tokenlist.json';
import polygonTokenList from '../token-lists/polygon-tokenlist.json';
import sokolTokenList from '../token-lists/sokol-tokenlist.json';
import gnosisTokenList from '../token-lists/gnosis-tokenlist.json';
import { type TokenList } from '@uniswap/token-lists';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const MERCHANT_PAYMENT_UNIVERSAL_LINK_HOSTNAME = 'wallet.cardstack.com';
export const MERCHANT_PAYMENT_UNIVERSAL_LINK_STAGING_HOSTNAME = 'wallet-staging.stack.cards';
export const CARDWALLET_SCHEME = 'cardwallet';

export const supportedChains = {
  ethereum: ['mainnet', 'goerli'],
  gnosis: ['gnosis', 'sokol'],
  polygon: ['polygon'],
};

export const supportedChainsArray = Object.values(supportedChains).flat();

export type CardPayCapableNetworks = 'sokol' | 'gnosis';
export type SchedulerCapableNetworks = 'mainnet' | 'goerli' | 'polygon';
export type CardPayRequiredLayer1Networks = 'kovan' | 'mainnet';
export type SchedulerAndCardPayL1Networks = CardPayRequiredLayer1Networks & SchedulerCapableNetworks;

interface RequiredNetworkConstants {
  apiBaseUrl: string;
  blockExplorer: string;
  chainId: number;
  hubUrl: string;
  name: string;
  nativeTokenAddress: string;
  nativeTokenCoingeckoId: string;
  coingeckoPlatform: string;
  nativeTokenName: string;
  nativeTokenSymbol: string;
  nativeTokenDecimals: number;
  subgraphURL: string;
  relayServiceURL: string;
}

interface SchedulerCapableNetworkConstants {
  tokenList: TokenList;
  scheduledPaymentFeeFixedUSD: number;
  scheduledPaymentFeePercentage: number;
  uniswapPairInitCodeHash: string;
  publicRpcUrls: string[];
}

interface CardPayCapableNetworkConstants {
  tokenList: TokenList;
  bridgedDaiTokenSymbol: string;
  bridgedCardTokenSymbol: string;
  bridgeExplorer: string;
  merchantUniLinkDomain: string;
  relayServiceURL: string;
  tallyServiceURL: string;
}

interface CardPayRequiredLayer1NetworkConstants {
  bridgeExplorer: string;
  ambFinalizationRate: string;
}

type SchedulerAndCardPayL1NetworkConstants = CardPayRequiredLayer1NetworkConstants & SchedulerCapableNetworkConstants;

type Constants = RequiredNetworkConstants &
  Partial<SchedulerCapableNetworkConstants & CardPayCapableNetworkConstants & CardPayRequiredLayer1NetworkConstants>;

type ConstantKeys = keyof Constants;

type NetworkConstants<N> = RequiredNetworkConstants &
  (N extends SchedulerAndCardPayL1Networks
    ? SchedulerAndCardPayL1NetworkConstants
    : N extends CardPayCapableNetworks
    ? CardPayCapableNetworkConstants
    : N extends SchedulerCapableNetworks
    ? SchedulerCapableNetworkConstants
    : N extends CardPayRequiredLayer1Networks
    ? CardPayRequiredLayer1NetworkConstants
    : unknown);

export type Network = CardPayCapableNetworks | SchedulerCapableNetworks | CardPayRequiredLayer1Networks;

type NetworkConstantsKeys<N> = keyof NetworkConstants<N>;

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
  nativeTokenDecimals: 18,
  coingeckoPlatform: 'ethereum',
};

const bridgedTokens = {
  bridgedDaiTokenSymbol: 'DAI.CPXD',
  bridgedCardTokenSymbol: 'CARD.CPXD',
  coingeckoPlatform: 'xdai',
};

const polygonNativeTokens = {
  nativeTokenAddress: '0x0000000000000000000000000000000000001010',
  nativeTokenCoingeckoId: 'matic-network',
  nativeTokenSymbol: 'MATIC',
  nativeTokenName: 'Matic',
  nativeTokenDecimals: 18,
  coingeckoPlatform: 'polygon-pos',
};

const constants: {
  [N in Network]: NetworkConstants<N>;
} = {
  sokol: {
    ...testHubUrl,
    ...ethNativeTokens,
    ...bridgedTokens,
    tokenList: sokolTokenList,
    apiBaseUrl: 'https://blockscout.com/poa/sokol/api',
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
  },
  gnosis: {
    ...hubUrl,
    ...bridgedTokens,
    tokenList: gnosisTokenList,
    apiBaseUrl: 'https://blockscout.com/xdai/mainnet/api',
    blockExplorer: 'https://blockscout.com/xdai/mainnet',
    bridgeExplorer: 'https://alm-xdai.herokuapp.com/100',
    nativeTokenAddress: 'xdai',
    nativeTokenCoingeckoId: 'xdai',
    nativeTokenSymbol: 'XDAI',
    nativeTokenName: 'xDai',
    nativeTokenDecimals: 18,
    name: 'Gnosis Chain',
    relayServiceURL: 'https://relay.cardstack.com/api',
    subgraphURL: 'https://graph.cardstack.com/subgraphs/name/habdelra/cardpay-xdai',
    merchantUniLinkDomain: MERCHANT_PAYMENT_UNIVERSAL_LINK_HOSTNAME,
    tallyServiceURL: 'https://reward-api.cardstack.com',
    chainId: 100,
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
    relayServiceURL: '',
    chainId: 42,
  },
  mainnet: {
    ...hubUrl,
    ...ethNativeTokens,
    tokenList: ethTokenList,
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
    subgraphURL: 'https://api.thegraph.com/subgraphs/name/cardstack/safe-tools-mainnet',
    uniswapPairInitCodeHash: '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f', // Result of keccak256(type(UniswapV2Pair).creationCode) from deployed UniswapV2Factory. We had to deploy our own Uniswap contracts on some networks (for now Mumbai) because they were missing, and add the patches/@uniswap+sdk+3.0.3.patch to support custom token pairs (by providing factory address and token pair code hash)
    publicRpcUrls: [
      'https://ethereum.publicnode.com',
      'https://rpc.ankr.com/eth',
      'https://eth-mainnet.public.blastapi.io',
    ],
  },
  goerli: {
    ...testHubUrl,
    ...ethNativeTokens,
    tokenList: goerliTokenList,
    apiBaseUrl: 'https://api-goerli.etherscan.io/api',
    blockExplorer: 'https://goerli.etherscan.io',
    name: 'Goerli',
    relayServiceURL: 'https://relay-goerli.staging.stack.cards/api',
    chainId: 5,
    scheduledPaymentFeeFixedUSD: 0,
    scheduledPaymentFeePercentage: 0,
    subgraphURL: 'https://api.thegraph.com/subgraphs/name/cardstack/safe-tools-goerli',
    uniswapPairInitCodeHash: '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f', //Result of keccak256(type(UniswapV2Pair).creationCode) from deployed UniswapV2Factory
    publicRpcUrls: ['https://eth-goerli.public.blastapi.io', 'https://rpc.ankr.com/eth_goerli'],
  },
  polygon: {
    ...hubUrl,
    ...polygonNativeTokens,
    tokenList: polygonTokenList,
    apiBaseUrl: 'https://api.polygonscan.com/api',
    blockExplorer: 'https://polygonscan.com',
    name: 'Polygon',
    chainId: 137,
    relayServiceURL: 'https://relay-polygon.cardstack.com/api',
    subgraphURL: 'https://api.thegraph.com/subgraphs/name/cardstack/safe-tools-polygon',
    scheduledPaymentFeeFixedUSD: 0.25,
    scheduledPaymentFeePercentage: 0.1, //10%
    uniswapPairInitCodeHash: '0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303', //Result of keccak256(type(UniswapV2Pair).creationCode) from deployed UniswapV2Factory
    publicRpcUrls: [
      'https://polygon-rpc.com/',
      'https://rpc-mainnet.matic.network',
      'https://matic-mainnet.chainstacklabs.com',
      'https://rpc-mainnet.maticvigil.com',
      'https://rpc-mainnet.matic.quiknode.pro',
    ],
  },
};

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

export function getConstantByNetwork<K extends NetworkConstantsKeys<N>, N extends Network | string>(
  name: K,
  network: N
): NetworkConstants<N>[K] {
  // @ts-expect-error ts doesn't know how to handle indexed type, but function params and return already does that;
  const value = constants[network as Network][name];

  if (!value && value !== 0) {
    throw new Error(`Don't know about the constant '${String(name)}' for network ${network}`);
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

  return getConstantByNetwork(name as NetworkConstantsKeys<typeof network>, network) as Constants[K];
}

export default constants;
