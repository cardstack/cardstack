import ERC20ABI from '../contracts/abi/erc-20';
import { AbiItem } from 'web3-utils';
import Web3 from 'web3';
import { networkName, safeContractCall } from './utils/general-utils';
import JsonRpcProvider from '../providers/json-rpc-provider';
import { Contract } from 'ethers';

export interface IAssets {
  getNativeTokenBalance(userAddress?: string): Promise<string>;
  getBalanceForToken(tokenAddress: string, tokenHolderAddress?: string): Promise<string>;
  getTokenInfo(tokenAddress: string): Promise<{ decimals: number; name: string; symbol: string }>;
}

export default class Assets implements IAssets {
  constructor(private web3: Web3) {}

  async getNativeTokenBalance(userAddress?: string): Promise<string> {
    let address = userAddress ?? (await this.web3.eth.getAccounts())[0];

    // Used to prevent block mismatch errors in infura (layer 1)
    // https://github.com/88mphapp/ng88mph-frontend/issues/55#issuecomment-940414832
    if (['kovan', 'mainnet'].includes(await networkName(this.web3))) {
      let previousBlockNumber = (await this.web3.eth.getBlockNumber()) - 1;
      return this.web3.eth.getBalance(address, previousBlockNumber);
    }
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

export class AssetsEthers implements IAssets {
  constructor(private ethersProvider: JsonRpcProvider) {}

  async getNativeTokenBalance(userAddress?: string): Promise<string> {
    let address = userAddress ?? (await this.ethersProvider.getSigner().getAddress());
    return String(await this.ethersProvider.getBalance(address, 'latest'));
  }

  async getBalanceForToken(tokenAddress: string, tokenHolderAddress?: string): Promise<string> {
    let address = tokenHolderAddress ?? (await this.ethersProvider.getSigner().getAddress());
    const tokenContract = new Contract(tokenAddress, ERC20ABI, this.ethersProvider);
    return (await tokenContract.balanceOf(address)) as string;
  }

  async getTokenInfo(tokenAddress: string): Promise<{ decimals: number; name: string; symbol: string }> {
    const tokenContract = new Contract(tokenAddress, ERC20ABI, this.ethersProvider);
    return {
      decimals: Number(await tokenContract.decimals()),
      name: (await tokenContract.name()) as string,
      symbol: (await tokenContract.symbol()) as string,
    };
  }
}
