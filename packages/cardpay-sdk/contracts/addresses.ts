import Web3 from 'web3';
import { networkName } from '../sdk/utils.js';

const addresses: {
  [network: string]: {
    [contractName: string]: string;
  };
} = {
  kovan: {
    daiToken: '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa',
    foreignBridge: '0xAfbA2216Aae9Afe23FD09Cf5dfe420F6ecdDD04B',
  },
  sokol: {
    homeBridge: '0x63AaCB22753d0DF234C32Ff62F5860da233cB360',
    daiCpxd: '0x2787E0fC3D2A3F6cd09000F284fC79452D96a1ad',
    prepaidCardManager: '0xeBDb1731dA9a5FC972DeD53E34AB2daC3B2565F7',
  },
  mainnet: {},
  xdai: {},
};

export default addresses;

export async function getAddress(contractName: string, web3: Web3): Promise<string> {
  let network = await networkName(web3);
  let address = addresses[network][contractName];
  if (!address) {
    throw new Error(`Don't know about the address for '${contractName}' for network ${network}`);
  }
  return address;
}
