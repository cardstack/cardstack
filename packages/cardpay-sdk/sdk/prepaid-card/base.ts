/*global fetch */

import BN from 'bn.js';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { Contract, ContractOptions } from 'web3-eth-contract';
import ERC677ABI from '../../contracts/abi/erc-677.js';
import PrepaidCardManagerABI from '../../contracts/v0.2.0/abi/prepaid-card-manager';
import { getAddress } from '../../contracts/addresses.js';
import { getConstant, ZERO_ADDRESS } from '../constants.js';
import getExchangeRate from '../exchange-rate';
import { ERC20ABI } from '../../index.js';
import {
  Estimate,
  RelayTransaction,
  GnosisExecTx,
  Signature,
  sign,
  gasEstimate,
  executeTransaction,
  waitUntilTransactionMined,
} from '../utils';
import { TransactionReceipt } from 'web3-eth';
import { Log } from 'web3-core';

const { toBN, fromWei } = Web3.utils;
interface PayMerchantPayload extends Estimate {
  data: any;
}

export interface PayMerchantTx extends RelayTransaction {
  merchantAddress: string;
  payment: number; // this is not safe to use! Need to fix in relay server
  prepaidCardTxHash: string; // this is a hash of the txn data--not to be confused with the overall txn hash
  tokenAddress: string;
}

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
  ): Promise<PayMerchantTx> {
    if (spendAmount < 50) {
      // this is hard coded in the PrepaidCardManager contract
      throw new Error(`The amount to pay merchant §${spendAmount} SPEND is below the minimum allowable amount`);
    }
    let prepaidCardMgrAddress = await getAddress('prepaidCardManager', this.layer2Web3);
    let from = options?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let issuingToken = await this.issuingToken(prepaidCardAddress);
    let exchangeRate = await getExchangeRate(this.layer2Web3);
    let weiAmount = await exchangeRate.convertFromSpend(issuingToken, spendAmount);
    let token = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], issuingToken);
    let prepaidCardBalance = new BN(await token.methods.balanceOf(prepaidCardAddress).call());
    if (prepaidCardBalance.lt(new BN(weiAmount))) {
      throw new Error(
        `Prepaid card does not have enough balance to pay merchant. The issuing token ${issuingToken} balance of prepaid card ${prepaidCardAddress} is ${fromWei(
          prepaidCardBalance.toString()
        )}, payment amount in issuing token is ${fromWei(weiAmount)}`
      );
    }
    let payload = await this.getPayMerchantPayload(prepaidCardAddress, merchantSafe, issuingToken, weiAmount);
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
    let contractSignature: Signature = {
      v: 1,
      r: toBN(prepaidCardMgrAddress).toString(),
      s: 0,
    };
    // The hash for the signatures requires that owner signatures be sorted by address
    if (prepaidCardMgrAddress.toLowerCase() > from.toLowerCase()) {
      signatures = signatures.concat(contractSignature);
    } else {
      signatures = [contractSignature].concat(signatures);
    }

    let result = await this.executePayMerchant(
      prepaidCardAddress,
      issuingToken,
      merchantSafe,
      weiAmount,
      signatures,
      toBN(payload.lastUsedNonce + 1).toString()
    );
    return result;
  }

  async create(
    safeAddress: string,
    tokenAddress: string,
    faceValues: number[],
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
    let payload = await this.getCreateCardPayload(from, tokenAddress, amounts);
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

  private async getCreateCardPayload(owner: string, tokenAddress: string, amounts: BN[]): Promise<string> {
    let prepaidCardManagerAddress = await getAddress('prepaidCardManager', this.layer2Web3);
    let token = new this.layer2Web3.eth.Contract(ERC677ABI as AbiItem[], tokenAddress);
    let sum = new BN(0);
    for (let amount of amounts) {
      sum = sum.add(amount);
    }

    return token.methods
      .transferAndCall(
        prepaidCardManagerAddress,
        sum,
        this.layer2Web3.eth.abi.encodeParameters(['address', 'uint256[]'], [owner, amounts])
      )
      .encodeABI();
  }

  private async getPayMerchantPayload(
    prepaidCardAddress: string,
    merchantSafe: string,
    tokenAddress: string,
    amount: string
  ): Promise<PayMerchantPayload> {
    let relayServiceURL = await getConstant('relayServiceURL', this.layer2Web3);
    let url = `${relayServiceURL}/v1/prepaid-card/${prepaidCardAddress}/pay-for-merchant/get-params/`;
    let options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', //eslint-disable-line @typescript-eslint/naming-convention
      },
      body: JSON.stringify({
        tokenAddress,
        merchantAddress: merchantSafe,
        payment: amount,
      }),
    };
    let response = await fetch(url, options);
    if (!response?.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  }

  private async executePayMerchant(
    prepaidCardAddress: string,
    tokenAddress: string,
    merchantSafe: string,
    amount: string,
    signatures: Signature[],
    nonce: string
  ): Promise<PayMerchantTx> {
    let relayServiceURL = await getConstant('relayServiceURL', this.layer2Web3);
    const url = `${relayServiceURL}/v1/prepaid-card/${prepaidCardAddress}/pay-for-merchant/`;
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', //eslint-disable-line @typescript-eslint/naming-convention
      },
      body: JSON.stringify({
        nonce,
        tokenAddress,
        merchantAddress: merchantSafe,
        payment: amount,
        signatures,
      }),
    };
    let response = await fetch(url, options);
    if (!response?.ok) {
      throw new Error(await response.text());
    }
    return response.json();
  }

  private async getPrepaidCardsFromTxn(txnHash: string): Promise<string[]> {
    let prepaidCardMgrAddress = await getAddress('prepaidCardManager', this.layer2Web3);
    let txnReceipt = await waitUntilTransactionMined(this.layer2Web3, txnHash);
    return this.getParamsFromEvent(txnReceipt, this.createPrepaidCardEventABI(), prepaidCardMgrAddress).map(
      (createCardLog) => createCardLog.card
    );
  }

  private getParamsFromEvent(txnReceipt: TransactionReceipt, eventAbi: EventABI, address: string) {
    let eventParams = txnReceipt.logs
      .filter((log) => isEventMatch(log, eventAbi.topic, address))
      .map((log) => this.layer2Web3.eth.abi.decodeLog(eventAbi.abis, log.data, log.topics));
    return eventParams;
  }

  private createPrepaidCardEventABI(): EventABI {
    return {
      topic: this.layer2Web3.eth.abi.encodeEventSignature('CreatePrepaidCard(address,address,address,uint256)'),
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
          name: 'amount',
        },
      ],
    };
  }
}

function isEventMatch(log: Log, topic: string, address: string) {
  return log.topics[0] === topic && log.address === address;
}

interface EventABI {
  topic: string;
  abis: { type: string; name: string }[];
}
