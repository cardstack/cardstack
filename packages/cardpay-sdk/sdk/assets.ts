import ERC20ABI from '../contracts/abi/erc-20';
import { AbiItem } from 'web3-utils';
import Web3 from 'web3';

export default class Assets {
  constructor(private layer2Web3: Web3) {}

  async getNativeTokenBalance(): Promise<string> {
    let address = (await this.layer2Web3.eth.getAccounts())[0];

    return this.layer2Web3.eth.getBalance(address);
  }

  async getBalanceForToken(tokenAddress: string): Promise<string> {
    let address = (await this.layer2Web3.eth.getAccounts())[0];
    const tokenContract = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);

    return tokenContract.methods.balanceOf(address).call();
  }
}
