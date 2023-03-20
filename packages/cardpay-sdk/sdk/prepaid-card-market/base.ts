import BN from 'bn.js';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import PrepaidCardMarketABI from '../../contracts/abi/v0.9.0/prepaid-card-market';
import PrepaidCardManagerABI from '../../contracts/abi/v0.9.0/prepaid-card-manager';
import GnosisSafeABI from '../../contracts/abi/gnosis-safe';
import type { SuccessfulTransactionReceipt } from '../utils/successful-transaction-receipt';
import { ContractOptions } from 'web3-eth-contract';
import { isTransactionHash, TransactionOptions, waitForTransactionConsistency } from '../utils/general-utils';
import {
  EventABI,
  executeSend,
  executeSendWithRateLock,
  getNextNonceFromEstimate,
  getParamsFromEvent,
  getSendPayload,
  GnosisExecTx,
  SendPayload,
  Operation,
} from '../utils/safe-utils';
import { getAddress } from '../..';
import { Signature, signPrepaidCardSendTx, signSafeTxAsBytes } from '../utils/signing-utils';
import { fromWei } from '../currency-utils';
import { ZERO_ADDRESS } from '../constants';
import { PrepaidCardSafe } from '../safes';
import { getSDK } from '../version-resolver';
import { MAX_PREPAID_CARD_AMOUNT } from '../prepaid-card/base';
import { Signer } from 'ethers';

/**
 * The `PrepaidCardMarket` API is used to manage the inventory prepaid cards in the market contract, whose purpose is to provision prepaid cards to consumers who buy them. This API is used within the layer 2 network in which the Card Protocol runs. The `PrepaidCardMaket` API can be obtained from `getSDK()` with a `Web3` instance that is configured to operate on a layer 2 network (like Gnosis Chain or Sokol).
 * @example
 * ```ts
 * import { getSDK } from "@cardstack/cardpay-sdk";
 * let web3 = new Web3(myProvider); // Layer 2 web3 instance
 * let prepaidCardMarket = await getSDK('PrepaidCardMarket', web3);
 * ```
 * @group Cardpay
 */
export default class PrepaidCardMarket {
  constructor(private layer2Web3: Web3, private layer2Signer?: Signer) {}

  /**
   * This call returns the prepaid card inventory for a particular SKU.
   * @param sku The SKU in question
   * @param marketAddressptionally the address of the market contract (the default Cardstack market contract will be used if not provided)
   * @returns a promise for an array of `PrepaidCardSafe` objects (from `Safes.View`)
   * @example
   * ```ts
   * let prepaidCards = await prepaidCardMarket.getInventory(sku1000SPENDCards);
   * ```
   * @group Cardpay
   */
  async getInventory(sku: string, marketAddress?: string): Promise<PrepaidCardSafe[]> {
    let prepaidCardAPI = await getSDK('PrepaidCard', this.layer2Web3);
    marketAddress = marketAddress ?? (await getAddress('prepaidCardMarket', this.layer2Web3));
    let contract = new this.layer2Web3.eth.Contract(PrepaidCardMarketABI as AbiItem[], marketAddress);
    let prepaidCardAddresses = await contract.methods.getInventory(sku).call();
    return await prepaidCardAPI.resolvePrepaidCards(prepaidCardAddresses);
  }

  /**
   * This call returns whether or not the PrepaidCardMarket contract is currently paused.
   * @example
   * ```ts
   * let isPaused = await prepaidCardMarket.isPaused();
   * ```
   */
  async isPaused(marketAddress?: string): Promise<boolean> {
    marketAddress = marketAddress ?? (await getAddress('prepaidCardMarket', this.layer2Web3));
    let contract = new this.layer2Web3.eth.Contract(PrepaidCardMarketABI as AbiItem[], marketAddress);
    return await contract.methods.paused().call();
  }

  /**
   * This call obtains the details for the prepaid cards associated with a particular SKU.
   * @param sku The SKU in question
   * @param marketAddress Optionally the address of the market contract (the default
   * @example
   * ```ts
   * let {
   * issuer,
   * issuingToken,
   * faceValue,
   * customizationDID,
   * askPrice // in the native units of the issuing token (e.g. wei)
   * } = await prepaidCardMarket.getSKUInfo(sku1000SPENDCards);
   *
   * ```
   */
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

  /**
   * This call adds the specified prepaid card address to the inventory.
   * @param fundingPrepaidCard The prepaid card that is used to pay for the gas for this transaction
   * @param prepaidCardToAdd The prepaid card address to add to inventory
   * @param marketAddress Optionally the address of the market contract (the default Cardstack market contract will be used if not provided)
   * @param txnOptions You can optionally provide a TransactionOptions argument, to obtain the nonce or transaction hash of the operation before the creation process is complete
   * @param contractOptions You can optionally provide an object that specifies the "from" address. The gas price and gas limit will be calculated by the card protocol and are not configurable.
   * @returns a promise for a web3 transaction receipt.
   * @example
   * ```ts
   * let result = await prepaidCardsMarket.addToInventory(fundingPrepaidCard, cardToAdd);
   * ```
   */
  async addToInventory(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async addToInventory(
    fundingPrepaidCard: string,
    prepaidCardToAdd: string,
    marketAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async addToInventory(
    fundingPrepaidCardOrTxnHash: string,
    prepaidCardToAdd?: string,
    marketAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt> {
    if (isTransactionHash(fundingPrepaidCardOrTxnHash)) {
      let txnHash = fundingPrepaidCardOrTxnHash;
      return await waitForTransactionConsistency(this.layer2Web3, txnHash);
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
      Operation.CALL,
      '0',
      '0',
      '0',
      await prepaidCardAPI.issuingToken(prepaidCardToAdd),
      ZERO_ADDRESS,
      transferNonce,
      from,
      prepaidCardToAdd,
      this.layer2Signer
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
        await signPrepaidCardSendTx(this.layer2Web3, fundingPrepaidCard, payload, nonce, from, this.layer2Signer),
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
    return await waitForTransactionConsistency(this.layer2Web3, txnHash, fundingPrepaidCard, nonce!);
  }

  /**
   * This call removes the specified prepaid card addresses from inventory and returns them back to the prepaid card issuer.
   * @param fundingPrepaidCard The prepaid card that is used to pay for the gas for this transaction
   * @param prepaidCardAddresses he prepaid card addresses to remove from inventory
   * @param marketAddress Optionally the address of the market contract (the default Cardstack market contract will be used if not provided)
   * @param txnOptions You can optionally provide a TransactionOptions argument, to obtain the nonce or transaction hash of the operation before the creation process is complete
   * @param contractOptions You can optionally provide an object that specifies the "from" address. The gas price and gas limit will be calculated by the card protocol and are not configurable.
   * @returns a promise for a web3 transaction receipt.
   * @example
   * ```ts
   * let result = await prepaidCardsMarket.removeFromInventory(fundingPrepaidCard, cardsToRemove);
   * ```
   */
  async removeFromInventory(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async removeFromInventory(
    fundingPrepaidCard: string,
    prepaidCardAddresses: string[],
    marketAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async removeFromInventory(
    fundingPrepaidCardOrTxnHash: string,
    prepaidCardAddresses?: string[],
    marketAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt> {
    if (isTransactionHash(fundingPrepaidCardOrTxnHash)) {
      let txnHash = fundingPrepaidCardOrTxnHash;
      return await waitForTransactionConsistency(this.layer2Web3, txnHash);
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
        await signPrepaidCardSendTx(this.layer2Web3, fundingPrepaidCard, payload, nonce, from, this.layer2Signer),
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
    return await waitForTransactionConsistency(this.layer2Web3, txnHash, fundingPrepaidCard, nonce!);
  }

  /**
   *This call sets the ask price for the prepaid cards the belong to the specified SKU. The ask price is specified as a string in units of `wei` based on the issuing token for the prepaid cards in the specified SKU.
   * @param prepaidCard The prepaid card that is used to pay for the gas for issuing the transaction
   * @param sku he SKU whose ask price you are setting
   * @param askPrice The ask price as a string in the native units of the SKU's issuing token (e.g. `wei`)
   * @param marketAddress Optionally the address of the market contract (the default Cardstack market contract will be used if not provided)
   * @param txnOptions You can optionally provide a TransactionOptions argument, to obtain the nonce or transaction hash of the operation before the creation process is complete
   * @param contractOptions You can optionally provide an object that specifies the "from" address. The gas price and gas limit will be calculated by the card protocol and are not configurable.
   * @returns  a promise for a web3 transaction receipt.
   * @example
   * ```ts
   * let result = await prepaidCardMarket.setAsk(
   * fundingPrepaidCard,
   * sku1000SPENDCards,
   * toWei("10"));
   * ```
   */
  async setAsk(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async setAsk(
    prepaidCard: string,
    sku: string,
    askPrice: string,
    marketAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async setAsk(
    prepaidCardOrTxnHash: string,
    sku?: string,
    askPrice?: string,
    marketAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt> {
    if (isTransactionHash(prepaidCardOrTxnHash)) {
      let txnHash = prepaidCardOrTxnHash;
      return await waitForTransactionConsistency(this.layer2Web3, txnHash);
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
        await signPrepaidCardSendTx(this.layer2Web3, prepaidCardAddress, payload, nonce, from, this.layer2Signer),
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
    return await waitForTransactionConsistency(this.layer2Web3, txnHash, prepaidCardAddress, nonce!);
  }

  async getPrepaidCardFromProvisionTxnHash(txnHash: string, marketAddress?: string): Promise<PrepaidCardSafe> {
    let prepaidCardAPI = await getSDK('PrepaidCard', this.layer2Web3);
    let txnReceipt = await waitForTransactionConsistency(this.layer2Web3, txnHash);
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
