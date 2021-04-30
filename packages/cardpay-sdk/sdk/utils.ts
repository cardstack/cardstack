import Web3 from 'web3';
import { networks } from './constants.js';

export async function networkName(web3: Web3): Promise<string> {
  let id = await web3.eth.net.getId();
  let name = networks[id];
  if (!name) {
    throw new Error(`Don't know what name the network id ${id} is`);
  }
  return name;
}
