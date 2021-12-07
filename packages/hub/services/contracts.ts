import { getAddressByNetwork, getABI, AddressKeys } from '@cardstack/cardpay-sdk';
import config from 'config';
import Web3 from 'web3';

const { network } = config.get('web3') as { network: 'xdai' | 'sokol' };

export class Contracts {
  async getContract(web3Instance: Web3, abiName: string, contractName: AddressKeys) {
    let ABI = await getABI(abiName, web3Instance);
    let contract = new web3Instance.eth.Contract(ABI, getAddressByNetwork(contractName, network));

    return contract;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    contracts: Contracts;
  }
}
