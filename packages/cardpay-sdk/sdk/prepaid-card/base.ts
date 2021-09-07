import BN from 'bn.js';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { Contract, ContractOptions } from 'web3-eth-contract';
import ERC677ABI from '../../contracts/abi/erc-677';
import GnosisSafeABI from '../../contracts/abi/gnosis-safe';
import PrepaidCardManagerABI from '../../contracts/abi/v0.7.0/prepaid-card-manager';
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
} from '../utils/safe-utils';
import { TransactionOptions, waitUntilTransactionMined } from '../utils/general-utils';
import { signSafeTxAsRSV, Signature, signSafeTxAsBytes } from '../utils/signing-utils';
import { PrepaidCardSafe } from '../safes';
import { TransactionReceipt } from 'web3-core';

const { fromWei } = Web3.utils;
const POLL_INTERVAL = 500;
const TIMEOUT = 1000 * 60 * 5;
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

  async payMerchant(
    merchantSafe: string,
    prepaidCardAddress: string,
    spendAmount: number,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt> {
    if (spendAmount < 50) {
      // this is hard coded in the PrepaidCardManager contract
      throw new Error(`The amount to pay merchant §${spendAmount} SPEND is below the minimum allowable amount`);
    }
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let issuingToken = await this.issuingToken(prepaidCardAddress);
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

    let rateChanged = false;
    let layerTwoOracle = await getSDK('LayerTwoOracle', this.layer2Web3);
    let gnosisResult: GnosisExecTx | undefined;
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    do {
      let rateLock = await layerTwoOracle.getRateLock(issuingToken);
      try {
        let payload = await this.getPayMerchantPayload(prepaidCardAddress, merchantSafe, spendAmount, rateLock);
        if (nonce == null) {
          nonce = getNextNonceFromEstimate(payload);
          if (typeof onNonce === 'function') {
            onNonce(nonce);
          }
        }
        let signatures = await signSafeTxAsRSV(
          this.layer2Web3,
          issuingToken,
          0,
          payload.data,
          0,
          payload.safeTxGas,
          payload.dataGas,
          payload.gasPrice,
          payload.gasToken,
          payload.refundReceiver,
          nonce,
          from,
          prepaidCardAddress
        );
        gnosisResult = await this.executePayMerchant(
          prepaidCardAddress,
          merchantSafe,
          spendAmount,
          rateLock,
          signatures,
          nonce
        );
        break;
      } catch (e) {
        // The rate updates about once an hour, so if this is triggered, it should only be once
        if (e.message.includes('rate is beyond the allowable bounds')) {
          rateChanged = true;
          // TODO in this situation we should surface a message to the user that
          // the rate has changed and that we need to try again with a new rate
          console.warn(
            'The USD rate has fluctuated beyond allowable bounds between when the txn was signed and when it was executed, prompting the user to sign the txn again with a new rate'
          );
        } else {
          throw e;
        }
      }
    } while (rateChanged);

    if (!gnosisResult) {
      throw new Error(
        `Unable to obtain a gnosis transaction result for merchant payment from prepaid card ${prepaidCardAddress} to merchant safe ${merchantSafe} for ${spendAmount} SPEND`
      );
    }

    if (typeof onTxnHash === 'function') {
      await onTxnHash(gnosisResult.ethereumTx.txHash);
    }

    return await waitUntilTransactionMined(this.layer2Web3, gnosisResult.ethereumTx.txHash);
  }

  async transfer(
    prepaidCardAddress: string,
    newOwner: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt> {
    if (!(await this.canTransfer(prepaidCardAddress))) {
      throw new Error(`The prepaid card ${prepaidCardAddress} is not allowed to be transferred`);
    }
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let rateChanged = false;
    let prepaidCardMgr = await this.getPrepaidCardMgr();
    let layerTwoOracle = await getSDK('LayerTwoOracle', this.layer2Web3);
    let gasToken = await getAddress('cardCpxd', this.layer2Web3);
    let issuingToken = await this.issuingToken(prepaidCardAddress);
    let transferData = await prepaidCardMgr.methods.getTransferCardData(prepaidCardAddress, newOwner).call();

    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};

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
      transferNonce = currentNonce.toString() === '0' ? new BN('1') : currentNonce.add(new BN('2'));
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
      gasToken,
      ZERO_ADDRESS,
      transferNonce,
      from,
      prepaidCardAddress
    );
    let gnosisResult: GnosisExecTx | undefined;
    do {
      let rateLock = await layerTwoOracle.getRateLock(issuingToken);
      try {
        let payload = await this.getTransferPayload(prepaidCardAddress, newOwner, previousOwnerSignature, rateLock);
        if (nonce == null) {
          nonce = getNextNonceFromEstimate(payload);
          if (typeof onNonce === 'function') {
            onNonce(nonce);
          }
        }
        let signatures = await signSafeTxAsRSV(
          this.layer2Web3,
          issuingToken,
          0,
          payload.data,
          0,
          payload.safeTxGas,
          payload.dataGas,
          payload.gasPrice,
          payload.gasToken,
          payload.refundReceiver,
          nonce,
          from,
          prepaidCardAddress
        );
        gnosisResult = await this.executeTransfer(
          prepaidCardAddress,
          newOwner,
          previousOwnerSignature,
          rateLock,
          signatures,
          nonce
        );
        break;
      } catch (e) {
        // The rate updates about once an hour, so if this is triggered, it should only be once
        if (e.message.includes('rate is beyond the allowable bounds')) {
          rateChanged = true;
          // TODO in this situation we should surface a message to the user that
          // the rate has changed and that we need to try again with a new rate
          console.warn(
            'The USD rate has fluctuated beyond allowable bounds between when the txn was signed and when it was executed, prompting the user to sign the txn again with a new rate'
          );
        } else {
          throw e;
        }
      }
    } while (rateChanged);
    if (!gnosisResult) {
      throw new Error(
        `Unable to obtain a gnosis transaction result for prepaid card transfer of prepaid card ${prepaidCardAddress} to new owner ${newOwner}`
      );
    }

    if (typeof onTxnHash === 'function') {
      await onTxnHash(gnosisResult.ethereumTx.txHash);
    }

    return await waitUntilTransactionMined(this.layer2Web3, gnosisResult.ethereumTx.txHash);
  }

  async split(
    prepaidCardAddress: string,
    faceValues: number[],
    customizationDID: string | undefined,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<{ prepaidCards: PrepaidCardSafe[]; txReceipt: TransactionReceipt }> {
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

    let rateChanged = false;
    let gnosisResult: GnosisExecTx | undefined;
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    do {
      let rateLock = await layerTwoOracle.getRateLock(issuingToken);
      try {
        let payload = await this.getSplitPayload(
          prepaidCardAddress,
          totalAmountInSpend,
          amounts,
          faceValues,
          rateLock,
          customizationDID
        );
        if (nonce == null) {
          nonce = getNextNonceFromEstimate(payload);
          if (typeof onNonce === 'function') {
            onNonce(nonce);
          }
        }
        let signatures = await signSafeTxAsRSV(
          this.layer2Web3,
          issuingToken,
          0,
          payload.data,
          0,
          payload.safeTxGas,
          payload.dataGas,
          payload.gasPrice,
          payload.gasToken,
          payload.refundReceiver,
          nonce,
          from,
          prepaidCardAddress
        );
        gnosisResult = await this.executeSplit(
          prepaidCardAddress,
          totalAmountInSpend,
          amounts,
          faceValues,
          rateLock,
          signatures,
          nonce,
          customizationDID
        );
        break;
      } catch (e: any) {
        // The rate updates about once an hour, so if this is triggered, it should only be once
        if (e.message.includes('rate is beyond the allowable bounds')) {
          rateChanged = true;
          // TODO in this situation we should surface a message to the user that
          // the rate has changed and that we need to try again with a new rate
          console.warn(
            'The USD rate has fluctuated beyond allowable bounds between when the txn was signed and when it was executed, prompting the user to sign the txn again with a new rate'
          );
        } else {
          throw e;
        }
      }
    } while (rateChanged);
    if (!gnosisResult) {
      throw new Error(`Unable to split prepaid card ${prepaidCardAddress} into face values: ${faceValues.join(', ')}`);
    }

    if (typeof onTxnHash === 'function') {
      await onTxnHash(gnosisResult.ethereumTx.txHash);
    }

    let prepaidCardAddresses = await this.getPrepaidCardsFromTxn(gnosisResult.ethereumTx.txHash);

    return {
      prepaidCards: await this.resolvePrepaidCards(prepaidCardAddresses),
      txReceipt: await waitUntilTransactionMined(this.layer2Web3, gnosisResult.ethereumTx.txHash),
    };
  }

  async create(
    safeAddress: string,
    tokenAddress: string,
    faceValues: number[],
    customizationDID: string | undefined,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<{ prepaidCards: PrepaidCardSafe[]; txnReceipt: TransactionReceipt }> {
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

    let payload = await this.getCreateCardPayload(from, tokenAddress, amounts, faceValues, customizationDID);
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
    let signatures = await signSafeTxAsRSV(
      this.layer2Web3,
      tokenAddress,
      0,
      payload,
      0,
      estimate.safeTxGas,
      estimate.dataGas,
      estimate.gasPrice,
      estimate.gasToken,
      ZERO_ADDRESS,
      nonce,
      from,
      safeAddress
    );
    let gnosisTxn = await executeTransaction(
      this.layer2Web3,
      safeAddress,
      tokenAddress,
      0,
      payload,
      0,
      estimate.safeTxGas,
      estimate.dataGas,
      estimate.gasPrice,
      nonce,
      signatures,
      estimate.gasToken,
      ZERO_ADDRESS
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

  private async resolvePrepaidCards(prepaidCardAddresses: string[]): Promise<PrepaidCardSafe[]> {
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
        let prepaidCard = await safes.viewSafe(prepaidCardAddress);
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
    customizationDID = ''
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
          ['address', 'uint256[]', 'uint256[]', 'string'],
          [owner, issuingTokenAmounts, spendAmounts.map((i) => i.toString()), customizationDID]
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
    customizationDID = ''
  ): Promise<SendPayload> {
    return getSendPayload(
      this.layer2Web3,
      prepaidCardAddress,
      totalSpendAmount,
      rate,
      'split',
      this.layer2Web3.eth.abi.encodeParameters(
        ['uint256[]', 'uint256[]', 'string'],
        [issuingTokenAmounts, spendAmounts, customizationDID]
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

  private async executePayMerchant(
    prepaidCardAddress: string,
    merchantSafe: string,
    spendAmount: number,
    rate: string,
    signatures: Signature[],
    nonce: BN
  ): Promise<GnosisExecTx> {
    return await executeSend(
      this.layer2Web3,
      prepaidCardAddress,
      spendAmount,
      rate,
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
    signatures: Signature[],
    nonce: BN,
    customizationDID = ''
  ): Promise<GnosisExecTx> {
    return await executeSend(
      this.layer2Web3,
      prepaidCardAddress,
      totalSpendAmount,
      rate,
      'split',
      this.layer2Web3.eth.abi.encodeParameters(
        ['uint256[]', 'uint256[]', 'string'],
        [issuingTokenAmounts, spendAmounts, customizationDID]
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
    signatures: Signature[],
    nonce: BN
  ): Promise<GnosisExecTx> {
    return await executeSend(
      this.layer2Web3,
      prepaidCardAddress,
      0,
      rate,
      'transfer',
      this.layer2Web3.eth.abi.encodeParameters(['address', 'bytes'], [newOwner, previousOwnerSignature]),
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
}
