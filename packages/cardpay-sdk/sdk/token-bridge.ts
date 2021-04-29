import BN from 'bn.js';
import Web3 from 'web3';
import { TransactionReceipt } from 'web3-core';
import { ContractOptions } from 'web3-eth-contract';
import ERC20ABI from '../contracts/abi/erc-20.js';
import ForeignBridgeABI from '../contracts/abi/foreign-bridge-mediator.js';
import { getAddress } from '../contracts/addresses.js';

export default class TokenBridge {
  constructor(private layer1Web3: Web3) {}

  async approveTokens(tokenAddress: string, amount: BN, options?: ContractOptions): Promise<TransactionReceipt> {
    let from = options?.from ?? (await this.layer1Web3.eth.getAccounts())[0];
    let token = new this.layer1Web3.eth.Contract(ERC20ABI as any, tokenAddress);
    let foreignBridge = await getAddress('foreignBridge', this.layer1Web3);
    return await token.methods.approve(foreignBridge, amount).send({ ...options, from });
  }

  async relayTokens(tokenAddress: string, amount: BN, options?: ContractOptions): Promise<TransactionReceipt> {
    let from = options?.from ?? (await this.layer1Web3.eth.getAccounts())[0];
    let foreignBridge = new this.layer1Web3.eth.Contract(
      ForeignBridgeABI as any,
      await getAddress('foreignBridge', this.layer1Web3)
    );
    return await foreignBridge.methods.relayTokens(tokenAddress, amount).send({ ...options, from });
  }
}
