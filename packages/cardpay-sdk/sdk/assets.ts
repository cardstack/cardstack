import ERC20ABI from '../contracts/abi/erc-20';
import { AbiItem } from 'web3-utils';
import Web3 from 'web3';
import { safeContractCall } from './utils/general-utils';

export interface IAssets {
  getNativeTokenBalance(userAddress?: string): Promise<string>;
  getBalanceForToken(tokenAddress: string, tokenHolderAddress?: string): Promise<string>;
  getTokenInfo(tokenAddress: string): Promise<{ decimals: number; name: string; symbol: string }>;
}

export default class Assets implements IAssets {
  constructor(private web3: Web3) {}

  async getNativeTokenBalance(userAddress?: string): Promise<string> {
    let address = userAddress ?? (await this.web3.eth.getAccounts())[0];

    return this.web3.eth.getBalance(address);
  }

  async getBalanceForToken(tokenAddress: string, tokenHolderAddress?: string): Promise<string> {
    let address = tokenHolderAddress ?? (await this.web3.eth.getAccounts())[0];
    const tokenContract = new this.web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);

    return (await safeContractCall(this.web3, tokenContract, 'balanceOf', address)) as string;
  }

  async getTokenInfo(tokenAddress: string): Promise<{ decimals: number; name: string; symbol: string }> {
    const tokenContract = new this.web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);
    return {
      decimals: Number(await safeContractCall(this.web3, tokenContract, 'decimals')),
      name: (await safeContractCall(this.web3, tokenContract, 'name')) as string,
      symbol: (await safeContractCall(this.web3, tokenContract, 'symbol')) as string,
    };
  }
}
