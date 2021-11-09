import BN from 'bn.js';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { Contract, ContractOptions } from 'web3-eth-contract';
import ERC677ABI from '../../contracts/abi/erc-677';
import GnosisSafeABI from '../../contracts/abi/gnosis-safe';
import PrepaidCardManagerABI from '../../contracts/abi/v0.8.4/prepaid-card-manager';
import { getAddress } from '../../contracts/addresses';
import { ZERO_ADDRESS } from '../constants';
import { getSDK } from '../version-resolver';

import { ERC20ABI } from '../../index';
import {
  EventABI,
  getParamsFromEvent,
  GnosisExecTx,
  gasEstimate,
  executeTransaction,
  SendPayload,
  getSendPayload,
  executeSend,
  getNextNonceFromEstimate,
  executeSendWithRateLock,
} from '../utils/safe-utils';
import { isTransactionHash, TransactionOptions, waitUntilTransactionMined } from '../utils/general-utils';
import { Signature, signSafeTxAsBytes, signPrepaidCardSendTx, signSafeTx } from '../utils/signing-utils';
import { PrepaidCardSafe } from '../safes';
import { TransactionReceipt } from 'web3-core';
import { itemSetEventABI } from '../prepaid-card-market/base';

const { fromWei } = Web3.utils;
const POLL_INTERVAL = 500;
const TIMEOUT = 1000 * 60 * 5;
// We don't enforce a maximum payment amount on chain, but generally we want to
// stay below the AML limit of $10,000 USD.
export const MAXIMUM_PAYMENT_AMOUNT = 10000 * 100;
export const MAX_PREPAID_CARD_AMOUNT = 10;

export default class PrepaidCard {
  private prepaidCardManager: Contract | undefined;
  constructor(private layer2Web3: Web3) {}

  async priceForFaceValue(tokenAddress: string, spendFaceValue: number): Promise<string> {
    return await (await this.getPrepaidCardMgr()).methods
      .priceForFaceValue(tokenAddress, String(spendFaceValue))
      .call();
  }

  async gasFee(tokenAddress: string): Promise<string> {
    return await (await this.getPrepaidCardMgr()).methods.gasFee(tokenAddress).call();
  }

  async issuingToken(prepaidCardAddress: string): Promise<string> {
    return (await (await this.getPrepaidCardMgr()).methods.cardDetails(prepaidCardAddress).call()).issueToken;
  }

  async customizationDID(prepaidCardAddress: string): Promise<string> {
    return (await (await this.getPrepaidCardMgr()).methods.cardDetails(prepaidCardAddress).call()).customizationDID;
  }

  async faceValue(prepaidCardAddress: string): Promise<number> {
    let faceValue = await (await this.getPrepaidCardMgr()).methods.faceValue(prepaidCardAddress).call();
    return parseInt(faceValue.toString());
  }

  async canSplit(prepaidCard: string): Promise<boolean> {
    let prepaidCardMgr = await this.getPrepaidCardMgr();
    let owner = await prepaidCardMgr.methods.getPrepaidCardOwner(prepaidCard).call();
    let issuer = await prepaidCardMgr.methods.getPrepaidCardIssuer(prepaidCard).call();
    return owner === issuer && owner !== ZERO_ADDRESS;
  }

  async canTransfer(prepaidCard: string): Promise<boolean> {
    let prepaidCardMgr = await this.getPrepaidCardMgr();
    let owner = await prepaidCardMgr.methods.getPrepaidCardOwner(prepaidCard).call();
    let issuer = await prepaidCardMgr.methods.getPrepaidCardIssuer(prepaidCard).call();
    let hasBeenUsed = await prepaidCardMgr.methods.hasBeenUsed(prepaidCard).call();
    return !hasBeenUsed && owner === issuer && owner !== ZERO_ADDRESS;
  }

  // since the limits are in units of SPEND, it is totally safe to represent as
  // a number vs a string
  async getPaymentLimits(): Promise<{ min: number; max: number }> {
    let prepaidCardMgr = await this.getPrepaidCardMgr();
    let min = await prepaidCardMgr.methods.MINIMUM_MERCHANT_PAYMENT().call();
    return { min: parseInt(min.toString()), max: MAXIMUM_PAYMENT_AMOUNT };
  }

  async payMerchant(txnHash: string): Promise<TransactionReceipt>;
  async payMerchant(
    merchantSafe: string,
    prepaidCardAddress: string,
    spendAmount: number,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt>;
  async payMerchant(
    merchantSafeOrTxnHash: string,
    prepaidCardAddress?: string,
    spendAmount?: number,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt> {
    if (isTransactionHash(merchantSafeOrTxnHash)) {
      let txnHash = merchantSafeOrTxnHash;
      return await waitUntilTransactionMined(this.layer2Web3, txnHash);
    }
    if (!prepaidCardAddress) {
      throw new Error('prepaidCardAddress is required');
    }
    if (!spendAmount) {
      throw new Error('spendAmount is required');
    }
    let merchantSafe = merchantSafeOrTxnHash;
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    if (spendAmount < 50) {
      // this is hard coded in the PrepaidCardManager contract
      throw new Error(`The amount to pay merchant §${spendAmount} SPEND is below the minimum allowable amount`);
    }
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    await this.convertFromSpendForPrepaidCard(
      prepaidCardAddress,
      spendAmount,
      (issuingToken, balanceAmount, requiredTokenAmount, symbol) =>
        new Error(
          `Prepaid card does not have enough balance to pay merchant. The issuing token ${issuingToken} balance of prepaid card ${prepaidCardAddress} is ${fromWei(
            balanceAmount
          )} ${symbol}, payment amount in issuing token is ${fromWei(requiredTokenAmount)} ${symbol}`
        )
    );

    let gnosisResult = await executeSendWithRateLock(this.layer2Web3, prepaidCardAddress, async (rateLock) => {
      let payload = await this.getPayMerchantPayload(prepaidCardAddress, merchantSafe, spendAmount, rateLock);
      if (nonce == null) {
        nonce = getNextNonceFromEstimate(payload);
        if (typeof onNonce === 'function') {
          onNonce(nonce);
        }
      }
      return await this.executePayMerchant(
        prepaidCardAddress,
        merchantSafe,
        spendAmount,
        rateLock,
        payload,
        await signPrepaidCardSendTx(this.layer2Web3, prepaidCardAddress, payload, nonce, from),
        nonce
      );
    });

    if (!gnosisResult) {
      throw new Error(
        `Unable to obtain a gnosis transaction result for merchant payment from prepaid card ${prepaidCardAddress} to merchant safe ${merchantSafe} for ${spendAmount} SPEND`
      );
    }

    let txnHash = gnosisResult.ethereumTx.txHash;

    if (typeof onTxnHash === 'function') {
      await onTxnHash(txnHash);
    }

    return await waitUntilTransactionMined(this.layer2Web3, txnHash);
  }

  async transfer(txnHash: string): Promise<TransactionReceipt>;
  async transfer(
    prepaidCardAddress: string,
    newOwner: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt>;
  async transfer(
    prepaidCardAddressOrTxnHash: string,
    newOwner?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt> {
    if (isTransactionHash(prepaidCardAddressOrTxnHash)) {
      let txnHash = prepaidCardAddressOrTxnHash;
      return await waitUntilTransactionMined(this.layer2Web3, txnHash);
    }
    let prepaidCardAddress = prepaidCardAddressOrTxnHash;
    if (!newOwner) {
      throw new Error('newOwner is required');
    }
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};

    if (!(await this.canTransfer(prepaidCardAddress))) {
      throw new Error(`The prepaid card ${prepaidCardAddress} is not allowed to be transferred`);
    }
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let prepaidCardMgr = await this.getPrepaidCardMgr();
    let transferData = await prepaidCardMgr.methods.getTransferCardData(prepaidCardAddress, newOwner).call();

    // the quirk here is that we are signing this txn in advance so we need to
    // optimistically advance the nonce by 2 to account for the fact that we are
    // executing the "send" action before this one (which advances the nonce by 1).
    let transferNonce: BN;
    if (nonce != null) {
      // a passed in nonce represents the next nonce to use, so we add 1 to it
      // to get the nonce we'd want to use for the transfer execTransaction
      transferNonce = nonce.add(new BN(1));
    } else {
      let prepaidCard = new this.layer2Web3.eth.Contract(GnosisSafeABI as AbiItem[], prepaidCardAddress);
      let currentNonce = new BN(await prepaidCard.methods.nonce().call());
      transferNonce = currentNonce.add(new BN('1'));
    }

    let [previousOwnerSignature] = await signSafeTxAsBytes(
      this.layer2Web3,
      prepaidCardAddress,
      0,
      transferData,
      0,
      '0',
      '0',
      '0',
      await this.issuingToken(prepaidCardAddress),
      ZERO_ADDRESS,
      transferNonce,
      from,
      prepaidCardAddress
    );
    let gnosisResult = await executeSendWithRateLock(this.layer2Web3, prepaidCardAddress, async (rateLock) => {
      let payload = await this.getTransferPayload(prepaidCardAddress, newOwner, previousOwnerSignature, rateLock);
      if (nonce == null) {
        nonce = getNextNonceFromEstimate(payload);
        if (typeof onNonce === 'function') {
          onNonce(nonce);
        }
      }
      return await this.executeTransfer(
        prepaidCardAddress,
        newOwner,
        previousOwnerSignature,
        rateLock,
        payload,
        await signPrepaidCardSendTx(this.layer2Web3, prepaidCardAddress, payload, nonce, from),
        nonce
      );
    });

    if (!gnosisResult) {
      throw new Error(
        `Unable to obtain a gnosis transaction result for prepaid card transfer of prepaid card ${prepaidCardAddress} to new owner ${newOwner}`
      );
    }

    let txnHash = gnosisResult.ethereumTx.txHash;
    if (typeof onTxnHash === 'function') {
      await onTxnHash(txnHash);
    }

    return await waitUntilTransactionMined(this.layer2Web3, txnHash);
  }

  async split(
    txnHash: string
  ): Promise<{ prepaidCards: PrepaidCardSafe[]; sku: string; txReceipt: TransactionReceipt }>;
  async split(
    prepaidCardAddress: string,
    faceValues: number[],
    marketAddress: string | undefined,
    customizationDID: string | undefined,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<{ prepaidCards: PrepaidCardSafe[]; sku: string; txReceipt: TransactionReceipt }>;
  async split(
    prepaidCardAddressOrTxnHash: string,
    faceValues?: number[],
    marketAddress?: string | undefined,
    customizationDID?: string | undefined,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<{ prepaidCards: PrepaidCardSafe[]; sku: string; txReceipt: TransactionReceipt }> {
    if (isTransactionHash(prepaidCardAddressOrTxnHash)) {
      let txnHash = prepaidCardAddressOrTxnHash;
      let txReceipt = await waitUntilTransactionMined(this.layer2Web3, txnHash);
      return {
        txReceipt,
        prepaidCards: await this.resolvePrepaidCards(await this.getPrepaidCardsFromTxn(txnHash)),
        sku: await this.getSkuFromTxnReceipt(txReceipt),
      };
    }
    let prepaidCardAddress = prepaidCardAddressOrTxnHash;
    if (!faceValues) {
      throw new Error(`faceValues must be provided`);
    }
    if (faceValues.length > MAX_PREPAID_CARD_AMOUNT) {
      throw new Error(`Cannot create more than ${MAX_PREPAID_CARD_AMOUNT} at a time`);
    }
    if (!(await this.canSplit(prepaidCardAddress))) {
      throw new Error(`The prepaid card ${prepaidCardAddress} is not allowed to be split`);
    }
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let layerTwoOracle = await getSDK('LayerTwoOracle', this.layer2Web3);
    let issuingToken = await this.issuingToken(prepaidCardAddress);
    let amountCache = new Map<number, string>();
    let amounts: BN[] = [];
    let totalWeiAmount = new BN('0');

    for (let faceValue of faceValues) {
      let weiAmount = amountCache.get(faceValue);
      if (weiAmount == null) {
        weiAmount = await this.priceForFaceValue(issuingToken, faceValue);
        amountCache.set(faceValue, weiAmount);
      }
      let weiAmountBN = new BN(weiAmount);
      totalWeiAmount = totalWeiAmount.add(weiAmountBN);
      amounts.push(weiAmountBN);
    }
    let totalAmountInSpend = await layerTwoOracle.convertToSpend(issuingToken, totalWeiAmount.toString());
    // add 1 SPEND to account for rounding errors, unconsumed tokens are
    // refunded back to the prepaid card
    totalAmountInSpend++;

    await this.convertFromSpendForPrepaidCard(
      prepaidCardAddress,
      totalAmountInSpend,
      (issuingToken, balanceAmount, requiredTokenAmount, symbol) =>
        new Error(
          `Prepaid card does not have enough balance to perform requested split. The issuing token ${issuingToken} balance of prepaid card ${prepaidCardAddress} is ${fromWei(
            balanceAmount
          )} ${symbol}, the total amount necessary for the split in issuing token is ${fromWei(
            requiredTokenAmount
          )} ${symbol}`
        )
    );

    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let gnosisResult = await executeSendWithRateLock(this.layer2Web3, prepaidCardAddress, async (rateLock) => {
      let payload = await this.getSplitPayload(
        prepaidCardAddress,
        totalAmountInSpend,
        amounts,
        faceValues,
        rateLock,
        customizationDID,
        marketAddress
      );
      if (nonce == null) {
        nonce = getNextNonceFromEstimate(payload);
        if (typeof onNonce === 'function') {
          onNonce(nonce);
        }
      }
      return await this.executeSplit(
        prepaidCardAddress,
        totalAmountInSpend,
        amounts,
        faceValues,
        rateLock,
        payload,
        await signPrepaidCardSendTx(this.layer2Web3, prepaidCardAddress, payload, nonce, from),
        nonce,
        customizationDID
      );
    });

    if (!gnosisResult) {
      throw new Error(`Unable to split prepaid card ${prepaidCardAddress} into face values: ${faceValues.join(', ')}`);
    }

    if (typeof onTxnHash === 'function') {
      await onTxnHash(gnosisResult.ethereumTx.txHash);
    }

    let prepaidCardAddresses = await this.getPrepaidCardsFromTxn(gnosisResult.ethereumTx.txHash);
    let txReceipt = await waitUntilTransactionMined(this.layer2Web3, gnosisResult.ethereumTx.txHash);

    return {
      txReceipt,
      prepaidCards: await this.resolvePrepaidCards(prepaidCardAddresses),
      sku: await this.getSkuFromTxnReceipt(txReceipt),
    };
  }

  async create(txnHash: string): Promise<{ prepaidCards: PrepaidCardSafe[]; txnReceipt: TransactionReceipt }>;
  async create(
    safeAddress: string,
    tokenAddress: string,
    faceValues: number[],
    marketAddress: string | undefined,
    customizationDID: string | undefined,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<{ prepaidCards: PrepaidCardSafe[]; txnReceipt: TransactionReceipt }>;
  async create(
    safeAddressOrTxnHash: string,
    tokenAddress?: string,
    faceValues?: number[],
    marketAddress?: string | undefined,
    customizationDID?: string | undefined,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<{ prepaidCards: PrepaidCardSafe[]; txnReceipt: TransactionReceipt }> {
    if (isTransactionHash(safeAddressOrTxnHash)) {
      let txnHash = safeAddressOrTxnHash;
      return {
        prepaidCards: await this.resolvePrepaidCards(await this.getPrepaidCardsFromTxn(txnHash)),
        txnReceipt: await waitUntilTransactionMined(this.layer2Web3, txnHash),
      };
    }
    let safeAddress = safeAddressOrTxnHash;
    if (!tokenAddress) {
      throw new Error('tokenAddress must be provided');
    }
    if (!faceValues) {
      throw new Error('faceValues must be provided');
    }
    if (faceValues.length > MAX_PREPAID_CARD_AMOUNT) {
      throw new Error(`Cannot create more than ${MAX_PREPAID_CARD_AMOUNT} at a time`);
    }
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let amountCache = new Map<number, string>();
    let amounts: BN[] = [];
    let totalWeiAmount = new BN('0');
    for (let faceValue of faceValues) {
      let weiAmount = amountCache.get(faceValue);
      if (weiAmount == null) {
        weiAmount = await this.priceForFaceValue(tokenAddress, faceValue);
        amountCache.set(faceValue, weiAmount);
      }
      let weiAmountBN = new BN(weiAmount);
      totalWeiAmount = totalWeiAmount.add(weiAmountBN);
      amounts.push(weiAmountBN);
    }
    let token = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);
    let symbol = await token.methods.symbol().call();
    let balance = new BN(await token.methods.balanceOf(safeAddress).call());
    if (balance.lt(totalWeiAmount)) {
      throw new Error(
        `Safe does not have enough balance to make prepaid card(s). The issuing token ${tokenAddress} balance of the safe ${safeAddress} is ${fromWei(
          balance
        )}, the total amount necessary to create prepaid cards is ${fromWei(
          totalWeiAmount
        )} ${symbol} + a small amount for gas`
      );
    }

    let payload = await this.getCreateCardPayload(
      from,
      tokenAddress,
      amounts,
      faceValues,
      customizationDID,
      marketAddress
    );
    let estimate = await gasEstimate(this.layer2Web3, safeAddress, tokenAddress, '0', payload, 0, tokenAddress);
    let gasCost = new BN(estimate.dataGas).add(new BN(estimate.baseGas)).mul(new BN(estimate.gasPrice));

    if (balance.lt(totalWeiAmount.add(gasCost))) {
      throw new Error(
        `Safe does not have enough balance to make prepaid card(s). The issuing token ${tokenAddress} balance of the safe ${safeAddress} is ${fromWei(
          balance
        )}, the total amount necessary to create prepaid cards is ${fromWei(
          totalWeiAmount
        )} ${symbol}, the gas cost is ${fromWei(gasCost)} ${symbol}`
      );
    }

    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};

    if (nonce == null) {
      nonce = getNextNonceFromEstimate(estimate);
      if (typeof onNonce === 'function') {
        onNonce(nonce);
      }
    }
    let gnosisTxn = await executeTransaction(
      this.layer2Web3,
      safeAddress,
      tokenAddress,
      payload,
      estimate,
      nonce,
      await signSafeTx(this.layer2Web3, safeAddress, tokenAddress, payload, estimate, nonce, from)
    );

    if (typeof onTxnHash === 'function') {
      await onTxnHash(gnosisTxn.ethereumTx.txHash);
    }

    let prepaidCardAddresses = await this.getPrepaidCardsFromTxn(gnosisTxn.ethereumTx.txHash);

    return {
      prepaidCards: await this.resolvePrepaidCards(prepaidCardAddresses),
      txnReceipt: await waitUntilTransactionMined(this.layer2Web3, gnosisTxn.ethereumTx.txHash),
    };
  }

  async registerRewardProgram(txnHash: string): Promise<{ rewardProgramId: string; txReceipt: TransactionReceipt }>;
  async registerRewardProgram(
    prepaidCardAddress: string,
    admin: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<{ rewardProgramId: string; txReceipt: TransactionReceipt }>;
  async registerRewardProgram(
    prepaidCardAddressOrTxnHash: string,
    admin?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<{ rewardProgramId: string; txReceipt: TransactionReceipt }> {
    let rewardManager = await getSDK('RewardManager', this.layer2Web3);
    let rewardProgramId = await rewardManager.newRewardProgramId();
    if (isTransactionHash(prepaidCardAddressOrTxnHash)) {
      let txnHash = prepaidCardAddressOrTxnHash;
      return {
        rewardProgramId,
        txReceipt: await waitUntilTransactionMined(this.layer2Web3, txnHash),
      };
    }
    if (!prepaidCardAddressOrTxnHash) {
      throw new Error('prepaidCardAddress is required');
    }
    let prepaidCardAddress = prepaidCardAddressOrTxnHash;
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let rewardProgramRegistrationFees = await rewardManager.getRewardProgramRegistrationFees();
    await this.convertFromSpendForPrepaidCard(
      prepaidCardAddress,
      rewardProgramRegistrationFees,
      (issuingToken, balanceAmount, requiredTokenAmount, symbol) =>
        new Error(
          `Prepaid card does not have enough balance to register reward program. The issuing token ${issuingToken} balance of prepaid card ${prepaidCardAddress} is ${fromWei(
            balanceAmount
          )} ${symbol}, payment amount in issuing token is ${fromWei(requiredTokenAmount)} ${symbol}`
        )
    );

    let prepaidCardMgr = await this.getPrepaidCardMgr();
    let rewardProgramAdmin: string =
      admin ?? (await prepaidCardMgr.methods.getPrepaidCardOwner(prepaidCardAddress).call());
    let gnosisResult = await executeSendWithRateLock(this.layer2Web3, prepaidCardAddress, async (rateLock) => {
      let payload = await this.getRegisterRewardProgramPayload(
        prepaidCardAddress,
        rewardProgramAdmin,
        rewardProgramId,
        rewardProgramRegistrationFees,
        rateLock
      );
      if (nonce == null) {
        nonce = getNextNonceFromEstimate(payload);
        if (typeof onNonce === 'function') {
          onNonce(nonce);
        }
      }
      return await this.executeRegisterRewardProgram(
        prepaidCardAddress,
        rewardProgramAdmin,
        rewardProgramId,
        rewardProgramRegistrationFees,
        rateLock,
        payload,
        await signPrepaidCardSendTx(this.layer2Web3, prepaidCardAddress, payload, nonce, from),
        nonce
      );
    });

    if (!gnosisResult) {
      throw new Error(
        `Unable to obtain a gnosis transaction result for register reward program from prepaid card ${prepaidCardAddressOrTxnHash} to merchant safe ${prepaidCardAddress} for ${rewardProgramRegistrationFees} SPEND`
      );
    }

    let txnHash = gnosisResult.ethereumTx.txHash;

    if (typeof onTxnHash === 'function') {
      await onTxnHash(txnHash);
    }

    return {
      rewardProgramId,
      txReceipt: await waitUntilTransactionMined(this.layer2Web3, txnHash),
    };
  }

  async registerRewardee(txnHash: string): Promise<{ rewardSafe: string; txReceipt: TransactionReceipt }>;
  async registerRewardee(
    prepaidCardAddress: string,
    rewardProgramId: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<{ rewardSafe: string; txReceipt: TransactionReceipt }>;
  async registerRewardee(
    prepaidCardAddressOrTxnHash: string,
    rewardProgramId?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<{ rewardSafe: string; txReceipt: TransactionReceipt }> {
    if (isTransactionHash(prepaidCardAddressOrTxnHash)) {
      let txnHash = prepaidCardAddressOrTxnHash;
      return {
        rewardSafe: await this.getRewardSafeFromTxn(txnHash),
        txReceipt: await waitUntilTransactionMined(this.layer2Web3, txnHash),
      };
    }
    if (!prepaidCardAddressOrTxnHash) {
      throw new Error('prepaidCardAddress is required');
    }
    if (!rewardProgramId) {
      throw new Error('rewardProgramId is required');
    }
    let prepaidCardAddress = prepaidCardAddressOrTxnHash;
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];

    let gnosisResult = await executeSendWithRateLock(this.layer2Web3, prepaidCardAddress, async (rateLock) => {
      let payload = await this.getRegisterRewardeePayload(prepaidCardAddress, rewardProgramId, rateLock);
      if (nonce == null) {
        nonce = getNextNonceFromEstimate(payload);
        if (typeof onNonce === 'function') {
          onNonce(nonce);
        }
      }
      return await this.executeRegisterRewardee(
        prepaidCardAddress,
        rewardProgramId,
        rateLock,
        payload,
        await signPrepaidCardSendTx(this.layer2Web3, prepaidCardAddress, payload, nonce, from),
        nonce
      );
    });

    if (!gnosisResult) {
      throw new Error(
        `Unable to obtain a gnosis transaction result for register rewardee payment from prepaid card ${prepaidCardAddress}`
      );
    }

    let txnHash = gnosisResult.ethereumTx.txHash;

    if (typeof onTxnHash === 'function') {
      await onTxnHash(txnHash);
    }

    return {
      rewardSafe: await this.getRewardSafeFromTxn(gnosisResult.ethereumTx.txHash),
      txReceipt: await waitUntilTransactionMined(this.layer2Web3, txnHash),
    };
  }

  async convertFromSpendForPrepaidCard(
    prepaidCardAddress: string,
    minimumSpendBalance: number,
    onError: (issuingToken: string, balanceAmount: string, requiredTokenAmount: string, symbol: string) => Error
  ): Promise<string> {
    let issuingToken = await this.issuingToken(prepaidCardAddress);
    let layerTwoOracle = await getSDK('LayerTwoOracle', this.layer2Web3);
    let weiAmount = await layerTwoOracle.convertFromSpend(issuingToken, minimumSpendBalance);
    let token = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], issuingToken);
    let symbol = await token.methods.symbol().call();
    let prepaidCardBalance = new BN(await token.methods.balanceOf(prepaidCardAddress).call());
    if (prepaidCardBalance.lt(new BN(weiAmount))) {
      onError(issuingToken, prepaidCardBalance.toString(), weiAmount, symbol);
    }
    return weiAmount;
  }

  async resolvePrepaidCards(prepaidCardAddresses: string[]): Promise<PrepaidCardSafe[]> {
    let safes = await getSDK('Safes', this.layer2Web3);
    let prepaidCards: PrepaidCardSafe[] | undefined;
    let startTime = Date.now();
    do {
      if (prepaidCards) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
      } else {
        prepaidCards = [];
      }
      for (let prepaidCardAddress of prepaidCardAddresses) {
        if (prepaidCards.find((p) => p.address === prepaidCardAddress)) {
          continue;
        }
        let prepaidCard = (await safes.viewSafe(prepaidCardAddress)).safe;
        if (prepaidCard?.type === 'prepaid-card') {
          prepaidCards.push(prepaidCard);
        }
      }
    } while (prepaidCards.length < prepaidCardAddresses.length && Date.now() - startTime < TIMEOUT);
    if (prepaidCards.length < prepaidCardAddresses.length) {
      throw new Error(`Timeout while waiting for the prepaid cards to be created.`);
    }
    return prepaidCards;
  }

  private async getPrepaidCardMgr() {
    if (this.prepaidCardManager) {
      return this.prepaidCardManager;
    }
    this.prepaidCardManager = new this.layer2Web3.eth.Contract(
      PrepaidCardManagerABI as AbiItem[],
      await getAddress('prepaidCardManager', this.layer2Web3)
    );
    return this.prepaidCardManager;
  }

  private async getCreateCardPayload(
    owner: string,
    tokenAddress: string,
    issuingTokenAmounts: BN[],
    spendAmounts: number[],
    customizationDID = '',
    marketAddress = ZERO_ADDRESS
  ): Promise<string> {
    let prepaidCardManagerAddress = await getAddress('prepaidCardManager', this.layer2Web3);
    let token = new this.layer2Web3.eth.Contract(ERC677ABI as AbiItem[], tokenAddress);
    let sum = new BN(0);
    for (let amount of issuingTokenAmounts) {
      sum = sum.add(amount);
    }

    return token.methods
      .transferAndCall(
        prepaidCardManagerAddress,
        sum,
        this.layer2Web3.eth.abi.encodeParameters(
          ['address', 'uint256[]', 'uint256[]', 'string', 'address'],
          [owner, issuingTokenAmounts, spendAmounts.map((i) => i.toString()), customizationDID, marketAddress]
        )
      )
      .encodeABI();
  }

  private async getPrepaidCardsFromTxn(txnHash: string): Promise<string[]> {
    let prepaidCardMgrAddress = await getAddress('prepaidCardManager', this.layer2Web3);
    let txnReceipt = await waitUntilTransactionMined(this.layer2Web3, txnHash);
    return getParamsFromEvent(this.layer2Web3, txnReceipt, this.createPrepaidCardEventABI(), prepaidCardMgrAddress).map(
      (createCardLog) => createCardLog.card
    );
  }

  private async getSkuFromTxnReceipt(txnReceipt: TransactionReceipt): Promise<string> {
    // this assumes the default prepaid card market address, once we have
    // multiple prepaid card markets we should refactor this
    let marketAddress = await getAddress('prepaidCardMarket', this.layer2Web3);
    let [event] = getParamsFromEvent(this.layer2Web3, txnReceipt, itemSetEventABI(this.layer2Web3), marketAddress);
    return event.sku;
  }

  private async getRewardSafeFromTxn(txnHash: string): Promise<any> {
    let rewardMgrAddress = await getAddress('rewardManager', this.layer2Web3);
    let txnReceipt = await waitUntilTransactionMined(this.layer2Web3, txnHash);
    return getParamsFromEvent(this.layer2Web3, txnReceipt, this.rewardeeRegisteredABI(), rewardMgrAddress)[0]
      .rewardSafe;
  }
  private async getPayMerchantPayload(
    prepaidCardAddress: string,
    merchantSafe: string,
    spendAmount: number,
    rate: string
  ): Promise<SendPayload> {
    return getSendPayload(
      this.layer2Web3,
      prepaidCardAddress,
      spendAmount,
      rate,
      'payMerchant',
      this.layer2Web3.eth.abi.encodeParameters(['address'], [merchantSafe])
    );
  }

  private async getSplitPayload(
    prepaidCardAddress: string,
    totalSpendAmount: number,
    issuingTokenAmounts: BN[],
    spendAmounts: number[],
    rate: string,
    customizationDID = '',
    marketAddress = ZERO_ADDRESS
  ): Promise<SendPayload> {
    return getSendPayload(
      this.layer2Web3,
      prepaidCardAddress,
      totalSpendAmount,
      rate,
      'split',
      this.layer2Web3.eth.abi.encodeParameters(
        ['uint256[]', 'uint256[]', 'string', 'address'],
        [issuingTokenAmounts, spendAmounts, customizationDID, marketAddress]
      )
    );
  }

  private async getTransferPayload(
    prepaidCardAddress: string,
    newOwner: string,
    previousOwnerSignature: string,
    rate: string
  ): Promise<SendPayload> {
    return getSendPayload(
      this.layer2Web3,
      prepaidCardAddress,
      0,
      rate,
      'transfer',
      this.layer2Web3.eth.abi.encodeParameters(['address', 'bytes'], [newOwner, previousOwnerSignature])
    );
  }

  private async getRegisterRewardProgramPayload(
    prepaidCardAddress: string,
    admin: string,
    rewardProgramId: string,
    spendAmount: number,
    rate: string
  ): Promise<SendPayload> {
    return getSendPayload(
      this.layer2Web3,
      prepaidCardAddress,
      spendAmount,
      rate,
      'registerRewardProgram',
      this.layer2Web3.eth.abi.encodeParameters(['address', 'address'], [admin, rewardProgramId])
    );
  }

  private async getRegisterRewardeePayload(
    prepaidCardAddress: string,
    rewardProgramId: string,
    rate: string
  ): Promise<SendPayload> {
    return getSendPayload(
      this.layer2Web3,
      prepaidCardAddress,
      0,
      rate,
      'registerRewardee',
      this.layer2Web3.eth.abi.encodeParameters(['address'], [rewardProgramId])
    );
  }

  private async executePayMerchant(
    prepaidCardAddress: string,
    merchantSafe: string,
    spendAmount: number,
    rate: string,
    payload: SendPayload,
    signatures: Signature[],
    nonce: BN
  ): Promise<GnosisExecTx> {
    return await executeSend(
      this.layer2Web3,
      prepaidCardAddress,
      spendAmount,
      rate,
      payload,
      'payMerchant',
      this.layer2Web3.eth.abi.encodeParameters(['address'], [merchantSafe]),
      signatures,
      nonce
    );
  }
  private async executeSplit(
    prepaidCardAddress: string,
    totalSpendAmount: number,
    issuingTokenAmounts: BN[],
    spendAmounts: number[],
    rate: string,
    payload: SendPayload,
    signatures: Signature[],
    nonce: BN,
    customizationDID = '',
    marketAddress = ZERO_ADDRESS
  ): Promise<GnosisExecTx> {
    return await executeSend(
      this.layer2Web3,
      prepaidCardAddress,
      totalSpendAmount,
      rate,
      payload,
      'split',
      this.layer2Web3.eth.abi.encodeParameters(
        ['uint256[]', 'uint256[]', 'string', 'address'],
        [issuingTokenAmounts, spendAmounts, customizationDID, marketAddress]
      ),
      signatures,
      nonce
    );
  }

  private async executeTransfer(
    prepaidCardAddress: string,
    newOwner: string,
    previousOwnerSignature: string,
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
      'transfer',
      this.layer2Web3.eth.abi.encodeParameters(['address', 'bytes'], [newOwner, previousOwnerSignature]),
      signatures,
      nonce
    );
  }

  private async executeRegisterRewardProgram(
    prepaidCardAddress: string,
    admin: string,
    rewardProgramId: string,
    spendAmount: number,
    rate: string,
    payload: SendPayload,
    signatures: Signature[],
    nonce: BN
  ): Promise<GnosisExecTx> {
    return await executeSend(
      this.layer2Web3,
      prepaidCardAddress,
      spendAmount,
      rate,
      payload,
      'registerRewardProgram',
      this.layer2Web3.eth.abi.encodeParameters(['address', 'address'], [admin, rewardProgramId]),
      signatures,
      nonce
    );
  }

  private async executeRegisterRewardee(
    prepaidCardAddress: string,
    rewardProgramId: string,
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
      'registerRewardee',
      this.layer2Web3.eth.abi.encodeParameters(['address'], [rewardProgramId]),
      signatures,
      nonce
    );
  }

  private createPrepaidCardEventABI(): EventABI {
    return {
      topic: this.layer2Web3.eth.abi.encodeEventSignature(
        'CreatePrepaidCard(address,address,address,address,uint256,uint256,uint256,string)'
      ),
      abis: [
        {
          type: 'address',
          name: 'supplier',
        },
        {
          type: 'address',
          name: 'card',
        },
        {
          type: 'address',
          name: 'token',
        },
        {
          type: 'address',
          name: 'createdFromDepot',
        },
        {
          type: 'uint256',
          name: 'issuingTokenAmount',
        },
        {
          type: 'uint256',
          name: 'spendAmount',
        },
        {
          type: 'uint256',
          name: 'gasFeeCollected',
        },
        {
          type: 'string',
          name: 'customizationDID',
        },
      ],
    };
  }

  private rewardeeRegisteredABI(): EventABI {
    return {
      topic: this.layer2Web3.eth.abi.encodeEventSignature('RewardeeRegistered(address,address,address)'),
      abis: [
        {
          type: 'address',
          name: 'rewardProgramId',
        },
        {
          type: 'address',
          name: 'rewardee',
        },
        {
          type: 'address',
          name: 'rewardSafe',
        },
      ],
    };
  }
}
