import BN from 'bn.js';
import Web3 from 'web3';
import { TransactionConfig } from 'web3-core';
import { Contract, ContractOptions } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';
import ERC20ABI from '../contracts/abi/erc-20';
import ForeignAMBABI from '../contracts/abi/foreign-amb';
import ForeignBridgeABI from '../contracts/abi/foreign-bridge-mediator';
import { getAddress } from '../contracts/addresses';
import {
  isTransactionHash,
  TransactionOptions,
  waitUntilBlock,
  waitUntilTransactionMined,
} from './utils/general-utils';
import type { SuccessfulTransactionReceipt } from './utils/successful-transaction-receipt';
const { fromWei } = Web3.utils;

// The TokenBridge is created between 2 networks, referred to as a Native (or Home) Network and a Foreign network.
// The Native or Home network has fast and inexpensive operations. All bridge operations to collect validator confirmations are performed on this side of the bridge.
// The Foreign network can be any chain, but generally refers to the Ethereum mainnet.

/**
 * @group Cardpay
 */
export interface ITokenBridgeForeignSide {
  unlockTokens(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  unlockTokens(
    tokenAddress: string,
    amount: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  relayTokens(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  relayTokens(
    tokenAddress: string,
    recipientAddress: string,
    amount: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  claimBridgedTokens(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  claimBridgedTokens(
    messageId: string,
    encodedData: string,
    signatures: string[],
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
}

// Note that as we support new CPXD tokens, we'll need to measure the gas limit
// the new tokens require for transfer which will effect this value. Ultimately
// this value reflects the gas limit that the token bridge is configured with
// for performing withdrawals.
const CLAIM_BRIDGED_TOKENS_GAS_LIMIT = 350000;

/**
 *
 * The `TokenBridgeForeignSide` API is used to bridge tokens into the layer 2 network in which the Card Protocol runs. The `TokenBridgeForeignSide` API can be obtained from `getSDK()` with a `Web3` instance that is configured to operate on a layer 1 network (like Ethereum Mainnet or Kovan).
 * @group Cardpay
 * @category Main
 * @example
 * ```ts
 * import { getSDK } from "@cardstack/cardpay-sdk";
 * let web3 = new Web3(myProvider); // Layer 1 web3 instance
 * let tokenBridge = await getSDK('TokenBridgeForeignSide', web3);
 * ```
 *
 * @remarks Note:  To accommodate the fix for infura block mismatch errors (made in CS-2391), we are waiting one extra block for all layer 1 transactions.
 */
export default class TokenBridgeForeignSide implements ITokenBridgeForeignSide {
  private foreignBridge: Contract | undefined;
  constructor(private layer1Web3: Web3) {}

  /**
   * This call will perform an ERC-20 `approve` action on the tokens to grant the Token Bridge contract the ability bridge your tokens. This method is invoked with:
   * - The contract address of the token that you are unlocking. Note that the token address must be a supported stable coin token. Use the `TokenBridgeForeignSide.getSupportedTokens` method to get a list of supported tokens.
   * - The amount of tokens to unlock. This amount should be in native units of the token (e.g. `wei`) and as string.
   * - You can optionally provide an object that specifies the nonce, onNonce callback, and/or onTxnHash callback as a third argument.
   * - You can optionally provide an object that specifies the from address, gas limit, and/or gas price as a fourth argument.
   *
   * @returns a promise that includes a web3 transaction receipt, from which you can obtain the transaction hash, ethereum events, and other details about the transaction https://web3js.readthedocs.io/en/v1.3.4/web3-eth-contract.html#id37.
   *
   * @example
   * ```ts
   * let txnReceipt = await tokenBridge.unlockTokens(
   *   "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa",
   *   new BN("1000000000000000000") // this is 1 token in wei
   * );
   * ```
   */
  async unlockTokens(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async unlockTokens(
    tokenAddress: string,
    amount: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async unlockTokens(
    tokenAddressOrTxnHash: string,
    amount?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt> {
    if (isTransactionHash(tokenAddressOrTxnHash)) {
      let txnHash = tokenAddressOrTxnHash;
      return await waitUntilOneBlockAfterTxnMined(this.layer1Web3, txnHash);
    }
    let tokenAddress = tokenAddressOrTxnHash;
    if (!amount) {
      throw new Error('amount is required');
    }

    let from = contractOptions?.from ?? (await this.layer1Web3.eth.getAccounts())[0];
    let token = new this.layer1Web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);
    let foreignBridge = await getAddress('foreignBridge', this.layer1Web3);
    let nextNonce = await this.getNextNonce(from);

    let withinLimit = await this.withinLimit(tokenAddress, amount);
    if (!withinLimit) {
      let maxPerTx = await this.maxPerTx(tokenAddress);
      let minPerTx = await this.minPerTx(tokenAddress);
      let dailyLimit = await this.dailyLimit(tokenAddress);
      let totalSpentPerDay = await this.totalSpentPerDay(tokenAddress);
      throw new Error(`
        unlock action NOT within configured limits. Attempted to unlock ${fromWei(amount)} amount of tokens

          Minimum Amount Per Tx: ${fromWei(minPerTx)}
          Maximum Amount Per Tx: ${fromWei(maxPerTx)}
          Total Amount Today: ${fromWei(totalSpentPerDay)}
          Daily Amount Limit: ${fromWei(dailyLimit)}

      `);
    }
    return await new Promise((resolve, reject) => {
      let { nonce, onNonce, onTxnHash } = txnOptions ?? {};

      let data = token.methods.approve(foreignBridge, amount).encodeABI();
      let tx: TransactionConfig = {
        ...contractOptions,
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
            resolve(await waitUntilOneBlockAfterTxnMined(this.layer1Web3, txnHash));
          } catch (e) {
            reject(e);
          }
        })
        .on('error', (error: Error) => {
          reject(error);
        });
    });
  }

  /**
   * This call will invoke the token bridge contract to relay tokens that have been unlocked in layer 1 and relay them to layer 2. It is always a good idea to relay the same number of tokens that were just unlocked. So if you unlocked 10 tokens, then you should subsequently relay 10 tokens. Once the tokens have been relayed to the layer 2 network they will be deposited in a Gnosis safe that you control in layer 2. You can use the `Safes.view` to obtain the address of the safe that you control in layer 2. Your safe will be reused for any subsequent tokens that you bridge into layer 2.
   *
   * @param tokenAddress The layer 1 contract address of the token that you are unlocking. Note that the token address must be a supported stable coin token. Use the `TokenBridgeForeignSide.getSupportedTokens` method to get a list of supported tokens.
   * @param recipientAddress The address of the layer 2 account that should own the resulting safe
   * @param amount The amount of tokens to unlock. This amount should be in native units of the token (e.g. `wei`) and as a string.
   * @param txnOptions You can optionally provide an object that specifies the nonce, onNonce callback, and/or onTxnHash callback as a fourth argument.
   * @param contractOptions You can optionally provide an object that specifies the from address, gas limit, and/or gas price as a fifth argument.
   *
   * @returns a promise that includes a web3 transaction receipt, from which you can obtain the transaction hash, ethereum events, and other details about the transaction https://web3js.readthedocs.io/en/v1.3.4/web3-eth-contract.html#id37.
   * @example
   * ```js
   * let txnReceipt = await tokenBridge.relayTokens(
   *   "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa", // token address
   *   "0x7cc103485069bbba15799f5dac5c42e7bbb48b4d064e61548022bf04db1bfc19", // layer 2 recipient address
   *   new BN("1000000000000000000") // this is 1 token in wei
   * );
   * ```
   */
  async relayTokens(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async relayTokens(
    tokenAddress: string,
    recipientAddress: string,
    amount: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async relayTokens(
    tokenAddressOrTxnHash: string,
    recipientAddress?: string,
    amount?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt> {
    if (isTransactionHash(tokenAddressOrTxnHash)) {
      let txnHash = tokenAddressOrTxnHash;
      return await waitUntilOneBlockAfterTxnMined(this.layer1Web3, txnHash);
    }
    let tokenAddress = tokenAddressOrTxnHash;
    if (!recipientAddress) {
      throw new Error('recipientAddress is required');
    }
    if (!amount) {
      throw new Error('amount is required');
    }
    let withinLimit = await this.withinLimit(tokenAddress, amount);
    if (!withinLimit) {
      let maxPerTx = await this.maxPerTx(tokenAddress);
      let minPerTx = await this.minPerTx(tokenAddress);
      let dailyLimit = await this.dailyLimit(tokenAddress);
      let totalSpentPerDay = await this.totalSpentPerDay(tokenAddress);
      throw new Error(`
        relay action NOT within configured limits. Attempted to relay ${fromWei(amount)} amount of tokens

          Minimum Amount Per Tx: ${fromWei(minPerTx)}
          Maximum Amount Per Tx: ${fromWei(maxPerTx)}
          Total Amount Today: ${fromWei(totalSpentPerDay)}
          Daily Amount Limit: ${fromWei(dailyLimit)}

      `);
    }
    let from = contractOptions?.from ?? (await this.layer1Web3.eth.getAccounts())[0];
    let foreignBridgeAddress = await getAddress('foreignBridge', this.layer1Web3);
    let foreignBridge = new this.layer1Web3.eth.Contract(ForeignBridgeABI as any, foreignBridgeAddress);
    let nextNonce = await this.getNextNonce(from);

    return await new Promise((resolve, reject) => {
      let { nonce, onNonce, onTxnHash } = txnOptions ?? {};

      let data = foreignBridge.methods.relayTokens(tokenAddress, recipientAddress, amount).encodeABI();
      let tx: TransactionConfig = {
        ...contractOptions,
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
            resolve(await waitUntilOneBlockAfterTxnMined(this.layer1Web3, txnHash));
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

  /**
   *
   * This call will allow the recipient of tokens bridge from layer 2 to layer 1 to be able to claim their bridge tokens in layer 1.

   * @param messageId The `messageId` of the bridging request
   * @param encodedData The `encodedData` of the bridging request
   * @param signatures The `signatures` of the bridge validators
   * @param txnOptions You can optionally provide an object that specifies the nonce, onNonce callback, and/or onTxnHash callback as a fourth argument.
   * @param contractOptions You can optionally provide an object that specifies the from address, gas limit, and/or gas price as a fifth argument.
   * @example
   * ```ts
   * let txnReceipt = await tokenBridge.claimBridgedTokens(messageId, encodedData, signatures);
   * ```
   *
   * @returns a promise for a web3 transaction receipt.
   */
  async claimBridgedTokens(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async claimBridgedTokens(
    messageId: string,
    encodedData: string,
    signatures: string[],
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async claimBridgedTokens(
    messageIdOrTxnHash: string,
    encodedData?: string,
    signatures?: string[],
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt> {
    if (!encodedData) {
      let txnHash = messageIdOrTxnHash;
      return await waitUntilOneBlockAfterTxnMined(this.layer1Web3, txnHash);
    }
    let messageId = messageIdOrTxnHash;
    if (!signatures) {
      throw new Error('signatures is required');
    }
    let from = contractOptions?.from ?? (await this.layer1Web3.eth.getAccounts())[0];
    let foreignAmbAddress = await getAddress('foreignAMB', this.layer1Web3);
    let foreignAmb = new this.layer1Web3.eth.Contract(ForeignAMBABI as AbiItem[], foreignAmbAddress);
    let events = await foreignAmb.getPastEvents('RelayedMessage', {
      fromBlock: 0,
      toBlock: 'latest',
      filter: { messageId },
    });
    if (events.length === 1) {
      let txnHash = events[0].transactionHash;
      return await waitUntilOneBlockAfterTxnMined(this.layer1Web3, txnHash);
    }
    const packedSignatures = prepSignaturesForExecution(signatures);
    let nextNonce = await this.getNextNonce(from);
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let executeSignatures = foreignAmb.methods.executeSignatures(encodedData, packedSignatures);
    let data = executeSignatures.encodeABI();
    let gas = await executeSignatures.estimateGas();

    return await new Promise((resolve, reject) => {
      let tx: TransactionConfig = {
        ...contractOptions,
        from,
        to: foreignAmbAddress,
        data,
        gas,
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
            resolve(await waitUntilOneBlockAfterTxnMined(this.layer1Web3, txnHash));
          } catch (e) {
            reject(e);
          }
        })
        .on('error', (error: Error) => {
          reject(error);
        });
    });
  }

  async withinLimit(tokenAddress: string, amount: string): Promise<boolean> {
    return await (await this.getForeignBridge()).methods.withinLimit(tokenAddress, amount).call();
  }

  async maxPerTx(tokenAddress: string): Promise<BN> {
    return new BN(await (await this.getForeignBridge()).methods.maxPerTx(tokenAddress).call());
  }

  async minPerTx(tokenAddress: string): Promise<BN> {
    return new BN(await (await this.getForeignBridge()).methods.minPerTx(tokenAddress).call());
  }

  async dailyLimit(tokenAddress: string): Promise<BN> {
    return new BN(await (await this.getForeignBridge()).methods.dailyLimit(tokenAddress).call());
  }

  async getCurrentDay(): Promise<string> {
    return await (await this.getForeignBridge()).methods.getCurrentDay().call();
  }
  async totalSpentPerDay(tokenAddress: string): Promise<BN> {
    let currentDay = await this.getCurrentDay();
    return new BN(await (await this.getForeignBridge()).methods.totalSpentPerDay(tokenAddress, currentDay).call());
  }

  private async getNextNonce(from?: string): Promise<BN> {
    from = from ?? (await this.layer1Web3.eth.getAccounts())[0];
    // To accommodate the fix for infura block mismatch errors (made in CS-2391), we
    // are waiting one extra block for all layer 1 transactions.
    let previousBlockNumber = (await this.layer1Web3.eth.getBlockNumber()) - 1;
    let nonce = await this.layer1Web3.eth.getTransactionCount(from, previousBlockNumber);
    return new BN(String(nonce)); // EOA nonces are zero based
  }

  private async getForeignBridge(): Promise<Contract> {
    if (this.foreignBridge) {
      return this.foreignBridge;
    }
    this.foreignBridge = new this.layer1Web3.eth.Contract(
      ForeignBridgeABI as AbiItem[],
      await getAddress('foreignBridge', this.layer1Web3)
    );
    return this.foreignBridge;
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

async function waitUntilOneBlockAfterTxnMined(web3: Web3, txnHash: string) {
  let receipt = await waitUntilTransactionMined(web3, txnHash);
  await waitUntilBlock(web3, receipt.blockNumber + 1);
  return receipt;
}
