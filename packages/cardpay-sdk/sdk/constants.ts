import Web3 from 'web3';
import invert from 'lodash/invert';
import mapValues from 'lodash/mapValues';
import { networkName } from './utils/general-utils';
import JsonRpcProvider from '../providers/json-rpc-provider';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const MERCHANT_PAYMENT_UNIVERSAL_LINK_HOSTNAME = 'wallet.cardstack.com';
export const MERCHANT_PAYMENT_UNIVERSAL_LINK_STAGING_HOSTNAME = 'wallet-staging.stack.cards';
export const CARDWALLET_SCHEME = 'cardwallet';

const SOKOL = {
  apiBaseUrl: 'https://blockscout.com/poa/sokol/api/eth-rpc',
  /** deployed instance of this contract: https://github.com/wbobeirne/eth-balance-checker */
  balanceCheckerContractAddress: '0xaeDFe60b0732924249866E3FeC71835EFb1fc9fF',
  blockExplorer: 'https://blockscout.com/poa/sokol',
  bridgeExplorer: 'https://alm-test-amb.herokuapp.com/77',
  hubUrl: 'https://hub-staging.stack.cards',
  nativeTokenAddress: 'spoa',
  nativeTokenCoingeckoId: 'ethereum',
  nativeTokenSymbol: 'SPOA',
  nativeTokenName: 'SPOA',
  bridgedDaiTokenSymbol: 'DAI.CPXD',
  bridgedCardTokenSymbol: 'CARD.CPXD',
  name: 'Sokol',
  relayServiceURL: 'https://relay-staging.stack.cards/api',
  subgraphURL: 'https://graph-staging.stack.cards/subgraphs/name/habdelra/cardpay-sokol',
  tallyServiceURL: 'https://reward-api-staging.stack.cards',
  merchantUniLinkDomain: MERCHANT_PAYMENT_UNIVERSAL_LINK_STAGING_HOSTNAME,
};
const KOVAN = {
  apiBaseUrl: 'https://api-kovan.etherscan.io/api',
  /** deployed instance of this contract: https://github.com/wbobeirne/eth-balance-checker */
  balanceCheckerContractAddress: '0xf3352813b612a2d198e437691557069316b84ebe',
  blockExplorer: 'https://kovan.etherscan.io',
  bridgeExplorer: 'https://alm-test-amb.herokuapp.com/42',
  hubUrl: 'https://hub-staging.stack.cards',
  nativeTokenAddress: 'eth',
  nativeTokenCoingeckoId: 'ethereum',
  nativeTokenSymbol: 'ETH',
  nativeTokenName: 'Ethereum',
  name: 'Kovan',
  // https://docs.tokenbridge.net/kovan-sokol-amb-bridge/about-the-kovan-sokol-amb shows 1 for finalization rate
  // but making this the same as mainnet so that the dev experience matches prod
  ambFinalizationRate: '20',
  subgraphURL: '',
};
const GOERLI = {
  apiBaseUrl: 'https://api-goerli.etherscan.io/api',
  blockExplorer: 'https://goerli.etherscan.io',
  hubUrl: 'https://hub-staging.stack.cards',
  nativeTokenAddress: 'eth',
  nativeTokenCoingeckoId: 'ethereum',
  nativeTokenSymbol: 'ETH',
  nativeTokenName: 'Ethereum',
  name: 'Goerli',
  relayServiceURL: 'https://relay-goerli.staging.stack.cards/api',
};
const MUMBAI = {
  apiBaseUrl: 'https://api-testnet.polygon.io/api',
  blockExplorer: 'https://mumbai.polygonscan.com',
  hubUrl: 'https://hub-staging.stack.cards',
  nativeTokenAddress: 'matic',
  nativeTokenCoingeckoId: 'MATIC',
  nativeTokenSymbol: 'MATIC',
  nativeTokenName: 'Matic',
  name: 'Mumbai',
  relayServiceURL: 'https://relay-mumbai.staging.stack.cards/api',
};
const MAINNET = {
  apiBaseUrl: 'https://api.etherscan.io/api',
  /** deployed instance of this contract: https://github.com/wbobeirne/eth-balance-checker */
  balanceCheckerContractAddress: '0x4dcf4562268dd384fe814c00fad239f06c2a0c2b',
  blockExplorer: 'https://etherscan.io',
  bridgeExplorer: 'https://alm-xdai.herokuapp.com/1',
  hubUrl: 'https://hub.cardstack.com',
  nativeTokenAddress: 'eth',
  nativeTokenCoingeckoId: 'ethereum',
  nativeTokenSymbol: 'ETH',
  nativeTokenName: 'Ethereum',
  name: 'Ethereum Mainnet',
  // check https://docs.tokenbridge.net/eth-xdai-amb-bridge/about-the-eth-xdai-amb for the finalization rate
  ambFinalizationRate: '20',
  relayServiceURL: 'https://relay-ethereum.cardstack.com/api',
};
const GNOSIS = {
  apiBaseUrl: 'https://blockscout.com/xdai/mainnet/api',
  /** deployed instance of this contract: https://github.com/wbobeirne/eth-balance-checker */
  balanceCheckerContractAddress: '0x6B78C121bBd10D8ef0dd3623CC1abB077b186F65',
  blockExplorer: 'https://blockscout.com/xdai/mainnet',
  bridgeExplorer: 'https://alm-xdai.herokuapp.com/100',
  hubUrl: 'https://hub.cardstack.com',
  nativeTokenAddress: 'xdai',
  nativeTokenCoingeckoId: 'xdai',
  nativeTokenSymbol: 'XDAI',
  nativeTokenName: 'xDai',
  bridgedDaiTokenSymbol: 'DAI.CPXD',
  bridgedCardTokenSymbol: 'CARD.CPXD',
  name: 'Gnosis Chain',
  relayServiceURL: 'https://relay.cardstack.com/api',
  subgraphURL: 'https://graph.cardstack.com/subgraphs/name/habdelra/cardpay-xdai',
  merchantUniLinkDomain: MERCHANT_PAYMENT_UNIVERSAL_LINK_HOSTNAME,
  tallyServiceURL: 'https://reward-api.cardstack.com',
};

type ConstantKeys =
  | keyof typeof SOKOL
  | keyof typeof KOVAN
  | keyof typeof MAINNET
  | keyof typeof GNOSIS
  | keyof typeof GOERLI
  | keyof typeof MUMBAI;

const constants: {
  [network: string]: {
    [prop: string]: string;
  };
} = Object.freeze({
  sokol: SOKOL,
  kovan: KOVAN,
  goerli: GOERLI,
  mumbai: MUMBAI,
  mainnet: MAINNET,
  gnosis: GNOSIS,
  xdai: GNOSIS,
});

export const networks: { [networkId: number]: string } = Object.freeze({
  1: 'mainnet',
  42: 'kovan',
  5: 'goerli',
  77: 'sokol',
  100: 'xdai',
  80001: 'mumbai',
});

// invert the networks object, so { '1': 'mainnet', ... } becomes { mainnet: '1', ... }
// then map over the values, so that { mainnet: '1', ... } has its values casted as numbers: { mainnet: 1, ... }
export const networkIds = mapValues(invert({ ...networks }), Number) as unknown as {
  [networkName: string]: number;
};
networkIds['gnosis'] = networkIds['xdai'];
Object.freeze(networkIds);

export function getConstantByNetwork(name: ConstantKeys, network: string): string {
  let value = constants[network][name];
  if (!value) {
    throw new Error(`Don't know about the constant '${name}' for network ${network}`);
  }
  return value;
}

export async function getConstant(
  name: ConstantKeys,
  web3OrNetworkOrEthersProvider: Web3 | string | JsonRpcProvider
): Promise<string> {
  let network: string;
  if (typeof web3OrNetworkOrEthersProvider === 'string') {
    network = web3OrNetworkOrEthersProvider;
  } else {
    network = await networkName(web3OrNetworkOrEthersProvider);
  }

  let value = constants[network][name];
  if (!value) {
    throw new Error(`Don't know about the constant '${name}' for network ${network}`);
  }
  return value;
}

export default constants;
