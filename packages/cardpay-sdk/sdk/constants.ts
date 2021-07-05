import Web3 from 'web3';
import invert from 'lodash/invert';
import { networkName } from './utils/general-utils';

const INFURA_PROJECT_ID = 'dfb8cbe2e916420a9dbcc1d1f5828406';
const KOVAN_INFURA_URL = 'https://kovan.infura.io/v3';
const KOVAN_INFURA_WSS_URL = 'wss://kovan.infura.io/ws/v3';
const MAINNET_INFURA_URL = 'https://mainnet.infura.io/v3';
const MAINNET_INFURA_WSS_URL = 'wss://mainnet.infura.io/ws/v3';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const SOKOL = {
  apiBaseUrl: 'https://blockscout.com/poa/sokol/api/eth-rpc',
  /** deployed instance of this contract: https://github.com/wbobeirne/eth-balance-checker */
  balanceCheckerContractAddress: '0xaeDFe60b0732924249866E3FeC71835EFb1fc9fF',
  blockExplorer: 'https://blockscout.com/poa/sokol',
  faucetUrl: 'https://faucet.poa.network',
  nativeTokenAddress: 'spoa',
  nativeTokenCoingeckoId: 'ethereum',
  nativeTokenSymbol: 'SPOA',
  nativeTokenName: 'SPOA',
  name: 'Sokol',
  rpcNode: 'https://sokol.stack.cards',
  rpcWssNode: 'https://sokol-wss.stack.cards',
  relayServiceURL: 'https://relay-staging.stack.cards/api',
  transactionServiceURL: 'https://transactions-staging.stack.cards/api',
  tallyServiceURL: 'https://tally-service-staging.stack.cards/api/v1',
};
const KOVAN = {
  apiBaseUrl: 'https://api-kovan.etherscan.io/api',
  /** deployed instance of this contract: https://github.com/wbobeirne/eth-balance-checker */
  balanceCheckerContractAddress: '0xf3352813b612a2d198e437691557069316b84ebe',
  blockExplorer: 'https://kovan.etherscan.io',
  bridgeExplorer: 'https://alm-test-amb.herokuapp.com/42',
  faucetUrl: 'https://faucet.kovan.network/',
  nativeTokenAddress: 'eth',
  nativeTokenCoingeckoId: 'ethereum',
  nativeTokenSymbol: 'KETH',
  nativeTokenName: 'Ethereum',
  name: 'Kovan',
  rpcNode: `${KOVAN_INFURA_URL}/${INFURA_PROJECT_ID}`,
  rpcWssNode: `${KOVAN_INFURA_WSS_URL}/${INFURA_PROJECT_ID}`,
};
const MAINNET = {
  apiBaseUrl: 'https://api.etherscan.io/api',
  /** deployed instance of this contract: https://github.com/wbobeirne/eth-balance-checker */
  balanceCheckerContractAddress: '0x4dcf4562268dd384fe814c00fad239f06c2a0c2b',
  blockExplorer: 'https://etherscan.io',
  bridgeExplorer: 'https://alm-xdai.herokuapp.com',
  nativeTokenAddress: 'eth',
  nativeTokenCoingeckoId: 'ethereum',
  nativeTokenSymbol: 'ETH',
  nativeTokenName: 'Ethereum',
  name: 'Ethereum Mainnet',
  rpcNode: `${MAINNET_INFURA_URL}/${INFURA_PROJECT_ID}`,
  rpcWssNode: `${MAINNET_INFURA_WSS_URL}/${INFURA_PROJECT_ID}`,
};
const XDAI = {
  apiBaseUrl: 'https://blockscout.com/xdai/mainnet/api',
  /** deployed instance of this contract: https://github.com/wbobeirne/eth-balance-checker */
  balanceCheckerContractAddress: '0x6B78C121bBd10D8ef0dd3623CC1abB077b186F65',
  blockExplorer: 'https://blockscout.com/xdai/mainnet',
  nativeTokenAddress: 'dai',
  nativeTokenCoingeckoId: 'dai',
  nativeTokenSymbol: 'DAI',
  nativeTokenName: 'xDai',
  name: 'xDai Chain',
  rpcNode: 'https://rpc.xdaichain.com',
  rpcWssNode: 'wss://rpc.xdaichain.com/wss',
  relayServiceURL: 'https://relay.cardstack.com/api',
  transactionServiceURL: 'https://transactions.cardstack.com/api',
};

type ConstantKeys = keyof typeof SOKOL | keyof typeof KOVAN | keyof typeof MAINNET | keyof typeof XDAI;

const constants: {
  [network: string]: {
    [prop: string]: string;
  };
} = Object.freeze({
  sokol: SOKOL,
  kovan: KOVAN,
  mainnet: MAINNET,
  xdai: XDAI,
});

export const networks: { [networkId: number]: string } = Object.freeze({
  1: 'mainnet',
  42: 'kovan',
  77: 'sokol',
  100: 'xdai',
});
export const networkIds = (Object.freeze(invert({ ...networks })) as unknown) as { [networkName: string]: number };

export function getConstantByNetwork(name: ConstantKeys, network: string): string {
  let value = constants[network][name];
  if (!value) {
    throw new Error(`Don't know about the constant '${name}' for network ${network}`);
  }
  return value;
}

export async function getConstant(name: ConstantKeys, network: string): Promise<string>;
export async function getConstant(name: ConstantKeys, web3: Web3): Promise<string>;
export async function getConstant(name: ConstantKeys, web3OrNetwork: Web3 | string): Promise<string> {
  let network: string;
  if (typeof web3OrNetwork === 'string') {
    network = web3OrNetwork;
  } else {
    network = await networkName(web3OrNetwork);
  }

  let value = constants[network][name];
  if (!value) {
    throw new Error(`Don't know about the constant '${name}' for network ${network}`);
  }
  return value;
}

export default constants;
