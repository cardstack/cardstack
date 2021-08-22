import BN from 'bn.js';
import Web3 from 'web3';
import { TransactionReceipt, TransactionConfig } from 'web3-core';
import { ContractOptions } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';
import ERC20ABI from '../contracts/abi/erc-20';
import ForeignAMBABI from '../contracts/abi/foreign-amb';
import ForeignBridgeABI from '../contracts/abi/foreign-bridge-mediator';
import { getAddress } from '../contracts/addresses';
import { waitUntilTransactionMined } from './utils/general-utils';

// The TokenBridge is created between 2 networks, referred to as a Native (or Home) Network and a Foreign network.
// The Native or Home network has fast and inexpensive operations. All bridge operations to collect validator confirmations are performed on this side of the bridge.
// The Foreign network can be any chain, but generally refers to the Ethereum mainnet.

export interface ITokenBridgeForeignSide {
  unlockTokens(
    tokenAddress: string,
    amount: string,
    onTxnHash?: (txnHash: string) => unknown,
    onNonce?: (nonce: BN) => void,
    nonce?: BN,
    options?: ContractOptions
  ): Promise<TransactionReceipt>;
  relayTokens(
    tokenAddress: string,
    recipientAddress: string,
    amount: string,
    onTxnHash?: (txnHash: string) => unknown,
    onNonce?: (nonce: BN) => void,
    nonce?: BN,
    options?: ContractOptions
  ): Promise<TransactionReceipt>;
  claimBridgedTokens(
    messageId: string,
    encodedData: string,
    signatures: string[],
    onTxnHash?: (txnHash: string) => unknown,
    onNonce?: (nonce: BN) => void,
    nonce?: BN,
    options?: ContractOptions
  ): Promise<TransactionReceipt>;
}

const CLAIM_BRIDGED_TOKENS_GAS_LIMIT = 290000;
export default class TokenBridgeForeignSide implements ITokenBridgeForeignSide {
  constructor(private layer1Web3: Web3) {}

  async unlockTokens(
    tokenAddress: string,
    amount: string,
    onTxnHash?: (txnHash: string) => unknown,
    onNonce?: (nonce: BN) => void,
    nonce?: BN,
    options?: ContractOptions
  ): Promise<TransactionReceipt> {
    let from = options?.from ?? (await this.layer1Web3.eth.getAccounts())[0];
    let token = new this.layer1Web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);
    let foreignBridge = await getAddress('foreignBridge', this.layer1Web3);
    let nextNonce = await this.getNextNonce(from);

    return await new Promise((resolve, reject) => {
      let data = token.methods.approve(foreignBridge, amount).encodeABI();
      let tx: TransactionConfig = {
        ...options,
        from,
        to: tokenAddress,
        data,
      };
      if (nonce != null) {
        tx.nonce = parseInt(nonce.toString()); // the web3 API requires this be a number, it should be ok to downcast this
      } else if (typeof onNonce === 'function') {
        onNonce(nextNonce);
      }

      this.layer1Web3.eth
        .sendTransaction(tx)
        .on('transactionHash', async (txnHash: string) => {
          if (typeof onTxnHash === 'function') {
            onTxnHash(txnHash);
          }
          try {
            resolve(await waitUntilTransactionMined(this.layer1Web3, txnHash));
          } catch (e) {
            reject(e);
          }
        })
        .on('error', (error: Error) => {
          reject(error);
        });
    });
  }

  async relayTokens(
    tokenAddress: string,
    recipientAddress: string,
    amount: string,
    onTxnHash?: (txnHash: string) => unknown,
    onNonce?: (nonce: BN) => void,
    nonce?: BN,
    options?: ContractOptions
  ): Promise<TransactionReceipt> {
    let from = options?.from ?? (await this.layer1Web3.eth.getAccounts())[0];
    let foreignBridgeAddress = await getAddress('foreignBridge', this.layer1Web3);
    let foreignBridge = new this.layer1Web3.eth.Contract(ForeignBridgeABI as any, foreignBridgeAddress);
    let nextNonce = await this.getNextNonce(from);

    return await new Promise((resolve, reject) => {
      let data = foreignBridge.methods.relayTokens(tokenAddress, recipientAddress, amount).encodeABI();
      let tx: TransactionConfig = {
        ...options,
        from,
        to: foreignBridgeAddress,
        data,
      };
      if (nonce != null) {
        tx.nonce = parseInt(nonce.toString()); // the web3 API requires this be a number, it should be ok to downcast this
      } else if (typeof onNonce === 'function') {
        onNonce(nextNonce);
      }

      this.layer1Web3.eth
        .sendTransaction(tx)
        .on('transactionHash', async (txnHash: string) => {
          if (typeof onTxnHash === 'function') {
            onTxnHash(txnHash);
          }
          try {
            resolve(await waitUntilTransactionMined(this.layer1Web3, txnHash));
          } catch (e) {
            reject(e);
          }
        })
        .on('error', (error: Error) => {
          reject(error);
        });
    });
  }

  async getEstimatedGasForWithdrawalClaim(_tokenAddress: string): Promise<BN> {
    // per Hassan, eventually this will be a token address specific amount, hence the for-now unused arg
    let withdrawalGasLimit = new BN(CLAIM_BRIDGED_TOKENS_GAS_LIMIT);
    let gasPrice = await this.layer1Web3.eth.getGasPrice();
    let estimatedGasInWei = withdrawalGasLimit.mul(new BN(gasPrice));
    let rounder = new BN(1e12);
    return estimatedGasInWei.divRound(rounder).mul(rounder);
  }

  async claimBridgedTokens(
    messageId: string,
    encodedData: string,
    signatures: string[],
    onTxnHash?: (txnHash: string) => unknown,
    onNonce?: (nonce: BN) => void,
    nonce?: BN,
    options?: ContractOptions
  ): Promise<TransactionReceipt> {
    let from = options?.from ?? (await this.layer1Web3.eth.getAccounts())[0];
    let foreignAmbAddress = await getAddress('foreignAMB', this.layer1Web3);
    let foreignAmb = new this.layer1Web3.eth.Contract(ForeignAMBABI as AbiItem[], foreignAmbAddress);
    let events = await foreignAmb.getPastEvents('RelayedMessage', {
      fromBlock: 0,
      toBlock: 'latest',
      filter: { messageId: messageId },
    });
    if (events.length === 1) {
      let txnHash = events[0].transactionHash;
      let receipt = await this.layer1Web3.eth.getTransactionReceipt(txnHash);
      return receipt;
    }
    const packedSignatures = prepSignaturesForExecution(signatures);
    let nextNonce = await this.getNextNonce(from);
    return await new Promise((resolve, reject) => {
      let data = foreignAmb.methods.executeSignatures(encodedData, packedSignatures).encodeABI();
      let tx: TransactionConfig = {
        ...options,
        from,
        to: foreignAmbAddress,
        data,
      };
      if (nonce != null) {
        tx.nonce = parseInt(nonce.toString()); // the web3 API requires this be a number, it should be ok to downcast this
      } else if (typeof onNonce === 'function') {
        onNonce(nextNonce);
      }

      this.layer1Web3.eth
        .sendTransaction(tx)
        .on('transactionHash', async (txnHash: string) => {
          if (typeof onTxnHash === 'function') {
            onTxnHash(txnHash);
          }
          try {
            resolve(await waitUntilTransactionMined(this.layer1Web3, txnHash));
          } catch (e) {
            reject(e);
          }
        })
        .on('error', (error: Error) => {
          reject(error);
        });
    });
  }

  private async getNextNonce(from?: string): Promise<BN> {
    from = from ?? (await this.layer1Web3.eth.getAccounts())[0];
    let nonce = await this.layer1Web3.eth.getTransactionCount(from);
    return new BN(String(nonce)); // EOA nonces are zero based
  }
}

function prepSignaturesForExecution(signatures: string[]) {
  return packSignatures(signatures.map(signatureToVRS));
}

function signatureToVRS(rawSignature: string) {
  const signature = strip0x(rawSignature);
  const v = signature.substr(64 * 2);
  const r = signature.substr(0, 32 * 2);
  const s = signature.substr(32 * 2, 32 * 2);
  return { v, r, s };
}

function packSignatures(array: { v: string; r: string; s: string }[]) {
  const length = strip0x(Web3.utils.toHex(array.length));
  const msgLength = length.length === 1 ? `0${length}` : length;
  const [v, r, s] = array.reduce(([vs, rs, ss], { v, r, s }) => [vs + v, rs + r, ss + s], ['', '', '']);
  return `0x${msgLength}${v}${r}${s}`;
}

function strip0x(s: string) {
  return Web3.utils.isHexStrict(s) ? s.substr(2) : s;
}
