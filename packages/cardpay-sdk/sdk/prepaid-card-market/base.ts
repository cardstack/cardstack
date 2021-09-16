import BN from 'bn.js';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import PrepaidCardMarketABI from '../../contracts/abi/v0.8.0/prepaid-card-market';
import { TransactionReceipt } from 'web3-core';
import { ContractOptions } from 'web3-eth-contract';
import { isTransactionHash, TransactionOptions, waitUntilTransactionMined } from '../utils/general-utils';
import {
  executeSend,
  executeSendWithRateLock,
  getNextNonceFromEstimate,
  getSendPayload,
  GnosisExecTx,
  SendPayload,
} from '../utils/safe-utils';
import { getAddress } from '../..';
import { Signature, signPrepaidCardSendTx } from '../utils/signing-utils';
import { fromWei } from '../currency-utils';
import { ZERO_ADDRESS } from '../constants';
import { PrepaidCardSafe } from '../safes';
import { getSDK } from '../version-resolver';

export default class PrepaidCardMarket {
  constructor(private layer2Web3: Web3) {}

  async getInventory(sku: string, marketAddress?: string): Promise<PrepaidCardSafe[]> {
    let prepaidCardAPI = await getSDK('PrepaidCard', this.layer2Web3);
    marketAddress = marketAddress ?? (await getAddress('prepaidCardMarket', this.layer2Web3));
    let contract = new this.layer2Web3.eth.Contract(PrepaidCardMarketABI as AbiItem[], marketAddress);
    let prepaidCardAddresses = await contract.methods.getInventory(sku).call();
    return await prepaidCardAPI.resolvePrepaidCards(prepaidCardAddresses);
  }

  async getSKUInfo(
    sku: string,
    marketAddress?: string
  ): Promise<
    | {
        faceValue: number;
        issuer: string;
        issuingToken: string;
        customizationDID: string;
        askPrice: string;
      }
    | undefined
  > {
    marketAddress = marketAddress ?? (await getAddress('prepaidCardMarket', this.layer2Web3));
    let contract = new this.layer2Web3.eth.Contract(PrepaidCardMarketABI as AbiItem[], marketAddress);
    let [rawResult, askPrice] = await Promise.all([
      contract.methods.skus(sku).call(),
      contract.methods.asks(sku).call(),
    ]);
    if (rawResult.issuer === ZERO_ADDRESS) {
      return;
    }
    let { faceValue, issuer, issuingToken, customizationDID } = rawResult;
    return {
      issuer,
      issuingToken,
      customizationDID,
      faceValue: parseInt(faceValue.toString()), // This number is in units of SPEND which is safe to handle as a number in js
      askPrice: askPrice.toString(),
    };
  }

  async setAsk(txnHash: string): Promise<TransactionReceipt>;
  async setAsk(
    prepaidCard: string,
    sku: string,
    askPrice: string,
    marketAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt>;
  async setAsk(
    prepaidCardOrTxnHash: string,
    sku?: string,
    askPrice?: string,
    marketAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt> {
    if (isTransactionHash(prepaidCardOrTxnHash)) {
      let txnHash = prepaidCardOrTxnHash;
      return await waitUntilTransactionMined(this.layer2Web3, txnHash);
    }
    if (!sku) {
      throw new Error('sku is required');
    }
    if (!askPrice) {
      throw new Error('askPrice is required');
    }
    let prepaidCardAddress = prepaidCardOrTxnHash;
    marketAddress = marketAddress ?? (await getAddress('prepaidCardMarket', this.layer2Web3));
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let gnosisResult = await executeSendWithRateLock(this.layer2Web3, prepaidCardAddress, async (rateLock) => {
      let payload = await this.getSetAskPayload(prepaidCardAddress, sku, askPrice, marketAddress!, rateLock);
      if (nonce == null) {
        nonce = getNextNonceFromEstimate(payload);
        if (typeof onNonce === 'function') {
          onNonce(nonce);
        }
      }
      return await this.executeSetAsk(
        prepaidCardAddress,
        sku,
        askPrice,
        marketAddress!,
        rateLock,
        payload,
        await signPrepaidCardSendTx(this.layer2Web3, prepaidCardAddress, payload, nonce, from),
        nonce
      );
    });

    if (!gnosisResult) {
      throw new Error(
        `Unable to obtain a gnosis transaction result for setAsk from prepaid card ${prepaidCardAddress} for sku ${sku} with askPrice ${fromWei(
          askPrice
        )} (in units of issuing token for prepaid card)`
      );
    }

    let txnHash = gnosisResult.ethereumTx.txHash;

    if (typeof onTxnHash === 'function') {
      await onTxnHash(txnHash);
    }
    return await waitUntilTransactionMined(this.layer2Web3, txnHash);
  }

  private async getSetAskPayload(
    prepaidCardAddress: string,
    sku: string,
    askPrice: string,
    marketAddress: string,
    rate: string
  ): Promise<SendPayload> {
    return getSendPayload(
      this.layer2Web3,
      prepaidCardAddress,
      0,
      rate,
      'setPrepaidCardAsk',
      this.layer2Web3.eth.abi.encodeParameters(['bytes32', 'uint256', 'address'], [sku, askPrice, marketAddress])
    );
  }

  private async executeSetAsk(
    prepaidCardAddress: string,
    sku: string,
    askPrice: string,
    marketAddress: string,
    rate: string,
    payload: SendPayload,
    signatures: Signature[],
    nonce: BN
  ): Promise<GnosisExecTx> {
    return await executeSend(
      this.layer2Web3,
      prepaidCardAddress,
      0,
      rate,
      payload,
      'setPrepaidCardAsk',
      this.layer2Web3.eth.abi.encodeParameters(['bytes32', 'uint256', 'address'], [sku, askPrice, marketAddress]),
      signatures,
      nonce
    );
  }
}
