import Web3 from 'web3';
import invert from 'lodash/invert.js';
import { networkName } from './utils.js';

const INFURA_PROJECT_ID = 'dfb8cbe2e916420a9dbcc1d1f5828406';
const KOVAN_INFURA_URL = 'https://kovan.infura.io/v3';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const constants: {
  [network: string]: {
    [prop: string]: string;
  };
} = {
  sokol: {
    blockExplorer: 'https://blockscout.com/poa/sokol',
    rpcNode: 'https://sokol.stack.cards',
    relayServiceURL: 'https://relay-staging.stack.cards/api',
    transactionServiceURL: 'https://transactions-staging.stack.cards/api',
  },
  kovan: {
    blockExplorer: 'https://kovan.etherscan.io',
    rpcNode: `${KOVAN_INFURA_URL}/${INFURA_PROJECT_ID}`,
  },
  mainnet: {},
  xdai: {},
};

export const networks: { [networkId: number]: string } = {
  1: 'mainnet',
  42: 'kovan',
  77: 'sokol',
  100: 'xdai',
};
export const networkIds = invert(networks);

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
