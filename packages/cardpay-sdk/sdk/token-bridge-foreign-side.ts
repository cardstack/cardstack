import Web3 from 'web3';
import { TransactionReceipt } from 'web3-core';
import { ContractOptions } from 'web3-eth-contract';
import ERC20ABI from '../contracts/abi/erc-20';
import ForeignBridgeABI from '../contracts/abi/foreign-bridge-mediator';
import { getAddress } from '../contracts/addresses';

// The TokenBridge is created between 2 networks, referred to as a Native (or Home) Network and a Foreign network.
// The Native or Home network has fast and inexpensive operations. All bridge operations to collect validator confirmations are performed on this side of the bridge.
// The Foreign network can be any chain, but generally refers to the Ethereum mainnet.

export default class TokenBridgeForeignSide {
  constructor(private layer1Web3: Web3) {}

  async unlockTokens(tokenAddress: string, amount: string, options?: ContractOptions): Promise<TransactionReceipt> {
    let from = options?.from ?? (await this.layer1Web3.eth.getAccounts())[0];
    let token = new this.layer1Web3.eth.Contract(ERC20ABI as any, tokenAddress);
    let foreignBridge = await getAddress('foreignBridge', this.layer1Web3);
    return await token.methods.approve(foreignBridge, amount).send({ ...options, from });
  }

  async relayTokens(
    tokenAddress: string,
    recipientAddress: string,
    amount: string,
    options?: ContractOptions
  ): Promise<TransactionReceipt> {
    let from = options?.from ?? (await this.layer1Web3.eth.getAccounts())[0];
    let foreignBridge = new this.layer1Web3.eth.Contract(
      ForeignBridgeABI as any,
      await getAddress('foreignBridge', this.layer1Web3)
    );
    return await foreignBridge.methods.relayTokens(tokenAddress, recipientAddress, amount).send({ ...options, from });
  }
}
