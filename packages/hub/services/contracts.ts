import { getAddressByNetwork, getABI, AddressKeys } from '@cardstack/cardpay-sdk';
import config from 'config';
import Web3 from 'web3';

const web3Config = config.get('web3') as { layer2Network: 'xdai' | 'sokol' };

export default class Contracts {
  async getContract(web3Instance: Web3, abiName: string, contractName: AddressKeys) {
    let ABI = await getABI(abiName, web3Instance);
    let contract = new web3Instance.eth.Contract(ABI, getAddressByNetwork(contractName, web3Config.layer2Network));

    return contract;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    contracts: Contracts;
  }
}
