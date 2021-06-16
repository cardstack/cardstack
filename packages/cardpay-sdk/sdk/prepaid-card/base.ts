/*global fetch */

import BN from 'bn.js';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { Contract, ContractOptions } from 'web3-eth-contract';
import ERC677ABI from '../../contracts/abi/erc-677';
import PrepaidCardManagerABI from '../../contracts/abi/v0.5.5/prepaid-card-manager';
import { getAddress } from '../../contracts/addresses';
import { getConstant, ZERO_ADDRESS } from '../constants';
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
} from '../utils/safe-utils';
import { waitUntilTransactionMined } from '../utils/general-utils';
import { sign, Signature } from '../utils/signing-utils';

const { toBN, fromWei } = Web3.utils;

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

  async payMerchant(
    merchantSafe: string,
    prepaidCardAddress: string,
    spendAmount: number,
    options?: ContractOptions
  ): Promise<GnosisExecTx | undefined> {
    if (spendAmount < 50) {
      // this is hard coded in the PrepaidCardManager contract
      throw new Error(`The amount to pay merchant §${spendAmount} SPEND is below the minimum allowable amount`);
    }
    let from = options?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let issuingToken = await this.issuingToken(prepaidCardAddress);
    await this.convertFromSpendForPrepaidCard(
      prepaidCardAddress,
      spendAmount,
      (issuingToken, balanceAmount, requiredTokenAmount) =>
        new Error(
          `Prepaid card does not have enough balance to pay merchant. The issuing token ${issuingToken} balance of prepaid card ${prepaidCardAddress} is ${fromWei(
            balanceAmount
          )}, payment amount in issuing token is ${fromWei(requiredTokenAmount)}`
        )
    );

    let rateChanged = false;
    do {
      let revenuePool = await getSDK('RevenuePool', this.layer2Web3);
      let rateLock = await revenuePool.currentTokenUSDRate(issuingToken);
      try {
        let payload = await this.getPayMerchantPayload(prepaidCardAddress, merchantSafe, spendAmount, rateLock);
        if (payload.lastUsedNonce == null) {
          payload.lastUsedNonce = -1;
        }
        let signatures = await sign(
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
          toBN(payload.lastUsedNonce + 1),
          from,
          prepaidCardAddress
        );
        return await this.executePayMerchant(
          prepaidCardAddress,
          merchantSafe,
          spendAmount,
          rateLock,
          signatures,
          toBN(payload.lastUsedNonce + 1).toString()
        );
      } catch (e) {
        // The rate updates about once an hour, so if this is triggered, it should only be once
        if (e.message.includes('rate is beyond the allowable bounds')) {
          rateChanged = true;
        } else {
          throw e;
        }
      }
    } while (rateChanged);
    return; // should never get here
  }

  async create(
    safeAddress: string,
    tokenAddress: string,
    faceValues: number[],
    customizationDID: string | undefined,
    onPrepaidCardsCreated?: (prepaidCardAddresses: string[]) => unknown,
    onGasLoaded?: () => unknown,
    options?: ContractOptions
  ): Promise<{ prepaidCardAddresses: string[]; gnosisTxn: GnosisExecTx }> {
    let from = options?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let amountCache = new Map<number, string>();
    let amounts: BN[] = [];
    for (let faceValue of faceValues) {
      let weiAmount = amountCache.get(faceValue);
      if (weiAmount == null) {
        weiAmount = await this.priceForFaceValue(tokenAddress, faceValue);
        amountCache.set(faceValue, weiAmount);
      }
      amounts.push(new BN(weiAmount));
    }
    let payload = await this.getCreateCardPayload(from, tokenAddress, amounts, faceValues, customizationDID);
    let estimate = await gasEstimate(this.layer2Web3, safeAddress, tokenAddress, '0', payload, 0, tokenAddress);

    if (estimate.lastUsedNonce == null) {
      estimate.lastUsedNonce = -1;
    }
    let signatures = await sign(
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
      toBN(estimate.lastUsedNonce + 1),
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
      toBN(estimate.lastUsedNonce + 1).toString(),
      signatures,
      estimate.gasToken,
      ZERO_ADDRESS
    );

    let prepaidCardAddresses = await this.getPrepaidCardsFromTxn(gnosisTxn.ethereumTx.txHash);

    if (typeof onPrepaidCardsCreated === 'function') {
      await onPrepaidCardsCreated(prepaidCardAddresses);
    }

    await Promise.all(prepaidCardAddresses.map((address) => this.loadGasIntoPrepaidCard(address)));
    if (typeof onGasLoaded === 'function') {
      await onGasLoaded();
    }
    return {
      prepaidCardAddresses,
      gnosisTxn,
    };
  }

  async convertFromSpendForPrepaidCard(
    prepaidCardAddress: string,
    minimumSpendBalance: number,
    onError: (issuingToken: string, balanceAmount: string, requiredTokenAmount: string) => Error
  ): Promise<string> {
    let issuingToken = await this.issuingToken(prepaidCardAddress);
    let exchangeRate = await getSDK('ExchangeRate', this.layer2Web3);
    let weiAmount = await exchangeRate.convertFromSpend(issuingToken, minimumSpendBalance);
    let token = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], issuingToken);
    let prepaidCardBalance = new BN(await token.methods.balanceOf(prepaidCardAddress).call());
    if (prepaidCardBalance.lt(new BN(weiAmount))) {
      onError(issuingToken, prepaidCardBalance.toString(), weiAmount);
    }
    return weiAmount;
  }

  private async loadGasIntoPrepaidCard(prepaidCardAddress: string) {
    let relayServiceURL = await getConstant('relayServiceURL', this.layer2Web3);
    let url = `${relayServiceURL}/v1/prepaid-card/${prepaidCardAddress}/load-gas/`;
    let options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', //eslint-disable-line @typescript-eslint/naming-convention
      },
    };
    let response = await fetch(url, options);
    if (!response?.ok) {
      throw new Error(await response.text());
    }
    let { txnHash } = await response.json();
    if (txnHash) {
      await waitUntilTransactionMined(this.layer2Web3, txnHash);
    }
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

  private async executePayMerchant(
    prepaidCardAddress: string,
    merchantSafe: string,
    spendAmount: number,
    rate: string,
    signatures: Signature[],
    nonce: string
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

  private createPrepaidCardEventABI(): EventABI {
    return {
      topic: this.layer2Web3.eth.abi.encodeEventSignature(
        'CreatePrepaidCard(address,address,address,uint256,uint256,uint256,string)'
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
