import ERC20ABI from '../contracts/abi/erc-20';
import { AbiItem } from 'web3-utils';
import Web3 from 'web3';
import { networkName, safeContractCall } from './utils/general-utils';
import JsonRpcProvider from '../providers/json-rpc-provider';
import { Contract } from 'ethers';

/**
 * @group Cardpay
 */
export interface IAssets {
  getNativeTokenBalance(userAddress?: string): Promise<string>;
  getBalanceForToken(tokenAddress: string, tokenHolderAddress?: string): Promise<string>;
  getTokenInfo(tokenAddress: string): Promise<{ decimals: number; name: string; symbol: string }>;
}

/**
 *
 * Thie `Assets` API is used issue queries for native coin balances and ERC-20 token balances, as well as to get ERC-20 token info. The `Assets` API can be obtained from `getSDK()` with a `Web3` instance that is configured to operate on either layer 1 or layer 2, depending on where the asset you wish to query lives.
 * @example
 * ```ts
 * import { getSDK } from "@cardstack/cardpay-sdk";
 * let web3 = new Web3(myProvider);
 * let assetAPI = await getSDK('Assets', web3);
 * ```
 * @group Cardpay
 * @category Main
 */
export default class Assets implements IAssets {
  constructor(private web3: Web3) {}

  /**
   *
   * This call returns the balance in native token for the specified address. So in Ethereum mainnet, this would be the ether balance. In Gnosis Chain this would be the XDAI token balance.
   * @returns promise for the native token amount as a string in native units (usually `wei`).
   * If no address is provided, then the balance of the first address in the wallet will be retrieved.
   * @example
   * ```ts
   * let assetsAPI = await getSDK('Assets', web3);
   * let etherBalance = await assetsAPI.getNativeTokenBalance(walletAddress);
   * ```
   */
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

  /**
   *
   * This call returns the balance in for an ERC-20 token from the specified address.
   * @returns a promise for the token amount as a string in native units of the token (usually) `wei`).
   * If no token holder address is provided, then the balance of the first address in the wallet will be retrieved.
   * @example
   * ```ts
   * let assetsAPI = await getSDK('Assets', web3);
   * let cardBalance = await assetsAPI.getBalanceForToken(cardTokenAddress, walletAddress);
   * ```
   */
  async getBalanceForToken(tokenAddress: string, tokenHolderAddress?: string): Promise<string> {
    let address = tokenHolderAddress ?? (await this.web3.eth.getAccounts())[0];
    const tokenContract = new this.web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);

    return (await safeContractCall(this.web3, tokenContract, 'balanceOf', address)) as string;
  }

  /**
   *
   * This call returns ERC-20 token information: the token name, the token symbol, and the token decimals for an ERC-20 token.
   * @example
   * ```ts
   * let assetsAPI = await getSDK('Assets', web3);
   * let { name, symbol, decimals } = await assetsAPI.getTokenInfo(cardTokenAddress);
   * ```
   */
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
