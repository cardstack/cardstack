import Web3 from 'web3';
import invert from 'lodash/invert';
import { networkName } from './utils';

const INFURA_PROJECT_ID = 'dfb8cbe2e916420a9dbcc1d1f5828406';
const KOVAN_INFURA_URL = 'https://kovan.infura.io/v3';
const KOVAN_INFURA_WSS_URL = 'wss://kovan.infura.io/ws/v3';
const MAINNET_INFURA_URL = 'https://mainnet.infura.io/v3';
const MAINNET_INFURA_WSS_URL = 'wss://mainnet.infura.io/ws/v3';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const constants: {
  [network: string]: {
    [prop: string]: string;
  };
} = Object.freeze({
  sokol: {
    blockExplorer: 'https://blockscout.com/poa/sokol',
    rpcNode: 'https://sokol.stack.cards',
    rpcWssNode: 'https://sokol-wss.stack.cards',
    relayServiceURL: 'https://relay-staging.stack.cards/api',
    transactionServiceURL: 'https://transactions-staging.stack.cards/api',
  },
  kovan: {
    blockExplorer: 'https://kovan.etherscan.io',
    bridgeExplorer: 'https://alm-test-amb.herokuapp.com/42',
    rpcNode: `${KOVAN_INFURA_URL}/${INFURA_PROJECT_ID}`,
    rpcWssNode: `${KOVAN_INFURA_WSS_URL}/${INFURA_PROJECT_ID}`,
  },
  mainnet: {
    blockExplorer: 'https://etherscan.io',
    bridgeExplorer: 'https://alm-xdai.herokuapp.com',
    rpcNode: `${MAINNET_INFURA_URL}/${INFURA_PROJECT_ID}`,
    rpcWssNode: `${MAINNET_INFURA_WSS_URL}/${INFURA_PROJECT_ID}`,
  },
  xdai: {
    blockExplorer: 'https://blockscout.com/xdai/mainnet',
    rpcNode: 'https://rpc.xdaichain.com',
    rpcWssNode: 'wss://rpc.xdaichain.com/wss',
    relayServiceURL: 'https://relay.cardstack.com/api',
    transactionServiceURL: 'https://transactions.cardstack.com/api',
  },
});

export const networks: { [networkId: number]: string } = Object.freeze({
  1: 'mainnet',
  42: 'kovan',
  77: 'sokol',
  100: 'xdai',
});
export const networkIds = (Object.freeze(invert({ ...networks })) as unknown) as { [networkName: string]: number };

export function getConstantByNetwork(name: string, network: string): string {
  let value = constants[network][name];
  if (!value) {
    throw new Error(`Don't know about the constant '${name}' for network ${network}`);
  }
  return value;
}

export async function getConstant(name: string, network: string): Promise<string>;
export async function getConstant(name: string, web3: Web3): Promise<string>;
export async function getConstant(name: string, web3OrNetwork: Web3 | string): Promise<string> {
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
