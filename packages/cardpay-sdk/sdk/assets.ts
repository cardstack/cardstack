import ERC20ABI from '../contracts/abi/erc-20';
import { AbiItem } from 'web3-utils';
import Web3 from 'web3';

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

    return tokenContract.methods.balanceOf(address).call();
  }

  async getTokenInfo(tokenAddress: string): Promise<{ decimals: number; name: string; symbol: string }> {
    const tokenContract = new this.web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);
    return {
      decimals: Number(await tokenContract.methods.decimals().call()),
      name: await tokenContract.methods.name().call(),
      symbol: await tokenContract.methods.symbol().call(),
    };
  }
}
