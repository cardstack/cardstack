import BN from 'bn.js';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import PrepaidCardMarketABI from '../../contracts/abi/v0.8.7/prepaid-card-market';
import PrepaidCardManagerABI from '../../contracts/abi/v0.8.7/prepaid-card-manager';
import GnosisSafeABI from '../../contracts/abi/gnosis-safe';
import { TransactionReceipt } from 'web3-core';
import { ContractOptions } from 'web3-eth-contract';
import { isTransactionHash, TransactionOptions, waitForSubgraphIndexWithTxnReceipt } from '../utils/general-utils';
import {
  EventABI,
  executeSend,
  executeSendWithRateLock,
  getNextNonceFromEstimate,
  getParamsFromEvent,
  getSendPayload,
  GnosisExecTx,
  SendPayload,
} from '../utils/safe-utils';
import { getAddress } from '../..';
import { Signature, signPrepaidCardSendTx, signSafeTxAsBytes } from '../utils/signing-utils';
import { fromWei } from '../currency-utils';
import { ZERO_ADDRESS } from '../constants';
import { PrepaidCardSafe } from '../safes';
import { getSDK } from '../version-resolver';
import { MAX_PREPAID_CARD_AMOUNT } from '../prepaid-card/base';

export default class PrepaidCardMarket {
  constructor(private layer2Web3: Web3) {}

  async getInventory(sku: string, marketAddress?: string): Promise<PrepaidCardSafe[]> {
    let prepaidCardAPI = await getSDK('PrepaidCard', this.layer2Web3);
    marketAddress = marketAddress ?? (await getAddress('prepaidCardMarket', this.layer2Web3));
    let contract = new this.layer2Web3.eth.Contract(PrepaidCardMarketABI as AbiItem[], marketAddress);
    let prepaidCardAddresses = await contract.methods.getInventory(sku).call();
    return await prepaidCardAPI.resolvePrepaidCards(prepaidCardAddresses);
  }

  async isPaused(marketAddress?: string): Promise<boolean> {
    marketAddress = marketAddress ?? (await getAddress('prepaidCardMarket', this.layer2Web3));
    let contract = new this.layer2Web3.eth.Contract(PrepaidCardMarketABI as AbiItem[], marketAddress);
    return await contract.methods.paused().call();
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

  async addToInventory(txnHash: string): Promise<TransactionReceipt>;
  async addToInventory(
    fundingPrepaidCard: string,
    prepaidCardToAdd: string,
    marketAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt>;
  async addToInventory(
    fundingPrepaidCardOrTxnHash: string,
    prepaidCardToAdd?: string,
    marketAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt> {
    if (isTransactionHash(fundingPrepaidCardOrTxnHash)) {
      let txnHash = fundingPrepaidCardOrTxnHash;
      return await waitForSubgraphIndexWithTxnReceipt(this.layer2Web3, txnHash);
    }
    if (!prepaidCardToAdd) {
      throw new Error('prepaidCardToAdd must be provided');
    }
    let prepaidCardAPI = await getSDK('PrepaidCard', this.layer2Web3);
    if (!(await prepaidCardAPI.canTransfer(prepaidCardToAdd))) {
      throw new Error('prepaidCardToAdd must not be used and owned by the issuer');
    }
    let fundingPrepaidCard = fundingPrepaidCardOrTxnHash;
    marketAddress = marketAddress ?? (await getAddress('prepaidCardMarket', this.layer2Web3));
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let prepaidCardManager = new this.layer2Web3.eth.Contract(
      PrepaidCardManagerABI as AbiItem[],
      await getAddress('prepaidCardManager', this.layer2Web3)
    );
    let transferData = await prepaidCardManager.methods.getTransferCardData(prepaidCardToAdd, marketAddress).call();
    let prepaidCard = new this.layer2Web3.eth.Contract(GnosisSafeABI as AbiItem[], prepaidCardToAdd);
    let transferNonce = new BN(await prepaidCard.methods.nonce().call());
    let [previousOwnerSignature] = await signSafeTxAsBytes(
      this.layer2Web3,
      prepaidCardToAdd,
      0,
      transferData,
      0,
      '0',
      '0',
      '0',
      await prepaidCardAPI.issuingToken(prepaidCardToAdd),
      ZERO_ADDRESS,
      transferNonce,
      from,
      prepaidCardToAdd
    );
    let gnosisResult = await executeSendWithRateLock(this.layer2Web3, fundingPrepaidCard, async (rateLock) => {
      let payload = await this.getAddToInventoryPayload(
        fundingPrepaidCard,
        prepaidCardToAdd,
        previousOwnerSignature,
        marketAddress!,
        rateLock
      );
      if (nonce == null) {
        nonce = getNextNonceFromEstimate(payload);
        if (typeof onNonce === 'function') {
          onNonce(nonce);
        }
      }
      return await this.executeAddToInventory(
        fundingPrepaidCard,
        prepaidCardToAdd,
        previousOwnerSignature,
        marketAddress!,
        rateLock,
        payload,
        await signPrepaidCardSendTx(this.layer2Web3, fundingPrepaidCard, payload, nonce, from),
        nonce
      );
    });

    if (!gnosisResult) {
      throw new Error(
        `Unable to obtain a gnosis transaction result for addToInventory with funding prepaid card ${fundingPrepaidCard} for prepaid cards to be added ${prepaidCardToAdd}`
      );
    }

    let txnHash = gnosisResult.ethereumTx.txHash;

    if (typeof onTxnHash === 'function') {
      await onTxnHash(txnHash);
    }
    return await waitForSubgraphIndexWithTxnReceipt(this.layer2Web3, txnHash);
  }

  async removeFromInventory(txnHash: string): Promise<TransactionReceipt>;
  async removeFromInventory(
    fundingPrepaidCard: string,
    prepaidCardAddresses: string[],
    marketAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt>;
  async removeFromInventory(
    fundingPrepaidCardOrTxnHash: string,
    prepaidCardAddresses?: string[],
    marketAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt> {
    if (isTransactionHash(fundingPrepaidCardOrTxnHash)) {
      let txnHash = fundingPrepaidCardOrTxnHash;
      return await waitForSubgraphIndexWithTxnReceipt(this.layer2Web3, txnHash);
    }
    if (!prepaidCardAddresses) {
      throw new Error('prepaidCardAddresses must be provided');
    }
    if (prepaidCardAddresses.length > MAX_PREPAID_CARD_AMOUNT) {
      throw new Error(`Cannot remove more than ${MAX_PREPAID_CARD_AMOUNT} at a time`);
    }
    let fundingPrepaidCard = fundingPrepaidCardOrTxnHash;
    marketAddress = marketAddress ?? (await getAddress('prepaidCardMarket', this.layer2Web3));
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let gnosisResult = await executeSendWithRateLock(this.layer2Web3, fundingPrepaidCard, async (rateLock) => {
      let payload = await this.getRemoveFromInventoryPayload(
        fundingPrepaidCard,
        prepaidCardAddresses,
        marketAddress!,
        rateLock
      );
      if (nonce == null) {
        nonce = getNextNonceFromEstimate(payload);
        if (typeof onNonce === 'function') {
          onNonce(nonce);
        }
      }
      return await this.executeRemoveFromInventory(
        fundingPrepaidCard,
        prepaidCardAddresses,
        marketAddress!,
        rateLock,
        payload,
        await signPrepaidCardSendTx(this.layer2Web3, fundingPrepaidCard, payload, nonce, from),
        nonce
      );
    });

    if (!gnosisResult) {
      throw new Error(
        `Unable to obtain a gnosis transaction result for removeFromInventory with funding prepaid card ${fundingPrepaidCard} for prepaid cards to be removed ${prepaidCardAddresses.join()}`
      );
    }

    let txnHash = gnosisResult.ethereumTx.txHash;

    if (typeof onTxnHash === 'function') {
      await onTxnHash(txnHash);
    }
    return await waitForSubgraphIndexWithTxnReceipt(this.layer2Web3, txnHash);
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
      return await waitForSubgraphIndexWithTxnReceipt(this.layer2Web3, txnHash);
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
    return await waitForSubgraphIndexWithTxnReceipt(this.layer2Web3, txnHash);
  }

  async getPrepaidCardFromProvisionTxnHash(txnHash: string, marketAddress?: string): Promise<PrepaidCardSafe> {
    let prepaidCardAPI = await getSDK('PrepaidCard', this.layer2Web3);
    let txnReceipt = await waitForSubgraphIndexWithTxnReceipt(this.layer2Web3, txnHash);
    marketAddress = marketAddress ?? (await getAddress('prepaidCardMarket', this.layer2Web3));
    let [event] = getParamsFromEvent(
      this.layer2Web3,
      txnReceipt,
      provisionPrepaidCardABI(this.layer2Web3),
      marketAddress
    );
    let { prepaidCard: prepaidCardAddress } = event;
    let [prepaidCard] = await prepaidCardAPI.resolvePrepaidCards([prepaidCardAddress]);
    return prepaidCard;
  }

  private async getAddToInventoryPayload(
    fundingPrepaidCard: string,
    prepaidCardToAdd: string,
    previousOwnerSignature: string,
    marketAddress: string,
    rate: string
  ): Promise<SendPayload> {
    return getSendPayload(
      this.layer2Web3,
      fundingPrepaidCard,
      0,
      rate,
      'setPrepaidCardInventory',
      this.layer2Web3.eth.abi.encodeParameters(
        ['address', 'address', 'bytes'],
        [prepaidCardToAdd, marketAddress, previousOwnerSignature]
      )
    );
  }

  private async executeAddToInventory(
    fundingPrepaidCard: string,
    prepaidCardToAdd: string,
    previousOwnerSignature: string,
    marketAddress: string,
    rate: string,
    payload: SendPayload,
    signatures: Signature[],
    nonce: BN
  ): Promise<GnosisExecTx> {
    return await executeSend(
      this.layer2Web3,
      fundingPrepaidCard,
      0,
      rate,
      payload,
      'setPrepaidCardInventory',
      this.layer2Web3.eth.abi.encodeParameters(
        ['address', 'address', 'bytes'],
        [prepaidCardToAdd, marketAddress, previousOwnerSignature]
      ),
      signatures,
      nonce
    );
  }

  private async getRemoveFromInventoryPayload(
    fundingPrepaidCard: string,
    prepaidCardAddresses: string[],
    marketAddress: string,
    rate: string
  ): Promise<SendPayload> {
    return getSendPayload(
      this.layer2Web3,
      fundingPrepaidCard,
      0,
      rate,
      'removePrepaidCardInventory',
      this.layer2Web3.eth.abi.encodeParameters(['address[]', 'address'], [prepaidCardAddresses, marketAddress])
    );
  }

  private async executeRemoveFromInventory(
    fundingPrepaidCard: string,
    prepaidCardAddresses: string[],
    marketAddress: string,
    rate: string,
    payload: SendPayload,
    signatures: Signature[],
    nonce: BN
  ): Promise<GnosisExecTx> {
    return await executeSend(
      this.layer2Web3,
      fundingPrepaidCard,
      0,
      rate,
      payload,
      'removePrepaidCardInventory',
      this.layer2Web3.eth.abi.encodeParameters(['address[]', 'address'], [prepaidCardAddresses, marketAddress]),
      signatures,
      nonce
    );
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

export function itemSetEventABI(web3: Web3): EventABI {
  return {
    topic: web3.eth.abi.encodeEventSignature('ItemSet(address,address,address,uint256,string,bytes32)'),
    abis: [
      {
        type: 'address',
        name: 'prepaidCard',
      },
      {
        type: 'address',
        name: 'issuer',
      },
      {
        type: 'address',
        name: 'issuingToken',
      },
      {
        type: 'uint256',
        name: 'faceValue',
      },
      {
        type: 'string',
        name: 'customizationDID',
      },
      {
        type: 'bytes32',
        name: 'sku',
      },
    ],
  };
}

export function provisionPrepaidCardABI(web3: Web3): EventABI {
  return {
    topic: web3.eth.abi.encodeEventSignature('ProvisionedPrepaidCard(address,address,bytes32,uint256)'),
    abis: [
      {
        type: 'address',
        name: 'prepaidCard',
      },
      {
        type: 'address',
        name: 'customer',
      },
      {
        type: 'bytes32',
        name: 'sku',
      },
      {
        type: 'uint256',
        name: 'askPrice',
      },
    ],
  };
}
