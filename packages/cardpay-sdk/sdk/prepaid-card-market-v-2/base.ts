import Web3 from 'web3';
import { AbiItem, fromWei, toWei } from 'web3-utils';
import PrepaidCardMarketV2ABI from '../../contracts/abi/v0.9.0/prepaid-card-market-v-2';
import BN from 'bn.js';
import { ContractOptions } from 'web3-eth-contract';
import { isTransactionHash, TransactionOptions, waitForTransactionConsistency } from '../utils/general-utils';
import {
  EventABI,
  executeSend,
  executeSendWithRateLock,
  executeTransaction,
  gasEstimate,
  getNextNonceFromEstimate,
  getParamsFromEvent,
  getSendPayload,
  GnosisExecTx,
  Operation,
  SendPayload,
} from '../utils/safe-utils';
import { Signature, signPrepaidCardSendTx, signSafeTx } from '../utils/signing-utils';

import { ZERO_ADDRESS } from '../constants';
import { Signer } from 'ethers';
import ERC677ABI from '../../contracts/abi/erc-677';
import { SuccessfulTransactionReceipt } from '../utils/successful-transaction-receipt';
import { getAddress } from '../..';

export default class PrepaidCardMarketV2 {
  constructor(private layer2Web3: Web3, private layer2Signer?: Signer) {}

  async isPaused(marketAddress?: string): Promise<boolean> {
    marketAddress = marketAddress ?? (await getAddress('prepaidCardMarketV2', this.layer2Web3));
    let contract = new this.layer2Web3.eth.Contract(PrepaidCardMarketV2ABI as AbiItem[], marketAddress);
    return await contract.methods.paused().call();
  }

  private async getAddTokensPayload(issuerAddress: string, tokenAddress: string, amount: BN): Promise<string> {
    let token = new this.layer2Web3.eth.Contract(ERC677ABI as AbiItem[], tokenAddress);
    let prepaidCardMarketV2Address = await getAddress('prepaidCardMarketV2', this.layer2Web3);
    let data = this.layer2Web3.eth.abi.encodeParameters(['address'], [issuerAddress]);
    return token.methods.transferAndCall(prepaidCardMarketV2Address, amount, data).encodeABI();
  }

  async addTokens(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async addTokens(
    issuerSafeAddress: string,
    issuerAddress: string,
    tokenAddress: string,
    amount: string,
    txnOptions?: TransactionOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async addTokens(
    issuerSafeAddressOrTxnHash: string,
    issuerAddress?: string,
    tokenAddress?: string,
    amount?: string,
    txnOptions?: TransactionOptions
  ): Promise<SuccessfulTransactionReceipt> {
    if (isTransactionHash(issuerSafeAddressOrTxnHash)) {
      let txnHash = issuerSafeAddressOrTxnHash;
      return await waitForTransactionConsistency(this.layer2Web3, txnHash);
    }
    let issuerSafeAddress = issuerSafeAddressOrTxnHash;
    if (!issuerAddress) {
      throw new Error('issuer must be provided');
    }
    if (!issuerSafeAddress) {
      throw new Error('issuer must be provided');
    }
    if (!tokenAddress) {
      throw new Error('tokenAddress must be provided');
    }
    if (!amount) {
      throw new Error('amount must be provided');
    }

    let from = issuerAddress;
    let token = new this.layer2Web3.eth.Contract(ERC677ABI as AbiItem[], tokenAddress);
    let symbol = await token.methods.symbol().call();
    let balance = new BN(await token.methods.balanceOf(issuerSafeAddress).call());
    let weiAmount = new BN(toWei(amount));
    if (balance.lt(weiAmount)) {
      throw new Error(
        `Safe does not have enough balance to add tokens. The token ${tokenAddress} balance of the safe ${issuerSafeAddress} is ${fromWei(
          balance
        )}, the total amount necessary to add tokens to the contract is ${fromWei(
          weiAmount
        )} ${symbol} + a small amount for gas`
      );
    }
    let payload = await this.getAddTokensPayload(issuerAddress, tokenAddress, weiAmount);

    let estimate = await gasEstimate(
      this.layer2Web3,
      issuerSafeAddress,
      tokenAddress,
      '0',
      payload,
      Operation.CALL,
      tokenAddress
    );
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};

    if (nonce == null) {
      nonce = getNextNonceFromEstimate(estimate);
      if (typeof onNonce === 'function') {
        onNonce(nonce);
      }
    }

    let gnosisTxn = await executeTransaction(
      this.layer2Web3,
      issuerSafeAddress,
      tokenAddress,
      payload,
      Operation.CALL,
      estimate,
      nonce,
      await signSafeTx(
        this.layer2Web3,
        issuerSafeAddress,
        tokenAddress,
        payload,
        Operation.CALL,
        estimate,
        nonce,
        from,
        this.layer2Signer
      )
    );

    if (typeof onTxnHash === 'function') {
      await onTxnHash(gnosisTxn.ethereumTx.txHash);
    }

    return await waitForTransactionConsistency(this.layer2Web3, gnosisTxn.ethereumTx.txHash, issuerSafeAddress, nonce);
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
    marketAddress = marketAddress ?? (await getAddress('prepaidCardMarketV2', this.layer2Web3));
    let contract = new this.layer2Web3.eth.Contract(PrepaidCardMarketV2ABI as AbiItem[], marketAddress);
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

  async addSKU(
    prepaidCardAddress: string,
    issuerSafe: string,
    faceValue: number,
    customizationDID: string,
    token: string,
    marketAddress?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ) {
    marketAddress = marketAddress ?? (await getAddress('prepaidCardMarketV2', this.layer2Web3));
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];

    let gnosisResult = await executeSendWithRateLock(this.layer2Web3, prepaidCardAddress, async (rateLock) => {
      let payload = await this.getAddSKUPayload(
        prepaidCardAddress,
        marketAddress!,
        issuerSafe,
        faceValue,
        customizationDID,
        token,
        rateLock
      );

      if (nonce == null) {
        nonce = getNextNonceFromEstimate(payload);
        if (typeof onNonce === 'function') {
          onNonce(nonce);
        }
      }

      return await this.executeAddSKU(
        prepaidCardAddress,
        marketAddress!,
        issuerSafe,
        faceValue,
        customizationDID,
        token,
        rateLock,
        payload,
        await signPrepaidCardSendTx(this.layer2Web3, prepaidCardAddress, payload, nonce, from, this.layer2Signer),
        nonce
      );
    });

    if (!gnosisResult) {
      throw new Error(
        `Unable to obtain a gnosis transaction result for addPrepaidCardSKU from prepaid card ${prepaidCardAddress} for face value ${faceValue}`
      );
    }

    let txnHash = gnosisResult.ethereumTx.txHash;

    if (typeof onTxnHash === 'function') {
      await onTxnHash(txnHash);
    }
    return await waitForTransactionConsistency(this.layer2Web3, txnHash, prepaidCardAddress, nonce!);
  }

  private async executeAddSKU(
    prepaidCardAddress: string,
    marketAddress: string,
    issuerSafeAddress: string,
    faceValue: number,
    customizationDID: string,
    tokenAddress: string,
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
      'addPrepaidCardSKU',
      this.layer2Web3.eth.abi.encodeParameters(
        ['uint256', 'string', 'address', 'address', 'address'],
        [faceValue, customizationDID, tokenAddress, marketAddress, issuerSafeAddress]
      ),
      signatures,
      nonce
    );
  }

  private async getAddSKUPayload(
    prepaidCardAddress: string,
    marketAddress: string,
    issuerSafeAddress: string,
    faceValue: number,
    customizationDID: string,
    tokenAddress: string,
    rate: string
  ): Promise<SendPayload> {
    return getSendPayload(
      this.layer2Web3,
      prepaidCardAddress,
      0,
      rate,
      'addPrepaidCardSKU',
      this.layer2Web3.eth.abi.encodeParameters(
        ['uint256', 'string', 'address', 'address', 'address'],
        [faceValue, customizationDID, tokenAddress, marketAddress, issuerSafeAddress]
      )
    );
  }

  async getQuantity(sku: string): Promise<number> {
    let marketAddress = await getAddress('prepaidCardMarketV2', this.layer2Web3);
    let contract = new this.layer2Web3.eth.Contract(PrepaidCardMarketV2ABI as AbiItem[], marketAddress);
    return await contract.methods.getQuantity(sku).call();
  }

  async getSKU(issuer: string, token: string, faceValue: number, customizationDID: string): Promise<number> {
    let marketAddress = await getAddress('prepaidCardMarketV2', this.layer2Web3);
    let contract = new this.layer2Web3.eth.Contract(PrepaidCardMarketV2ABI as AbiItem[], marketAddress);
    return await contract.methods.getSKU(issuer, token, faceValue, customizationDID).call();
  }

  async setAsk(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async setAsk(
    prepaidCard: string,
    sku: string,
    askPrice: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async setAsk(
    prepaidCardOrTxnHash: string,
    sku?: string,
    askPrice?: string,
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
    let marketAddress = await getAddress('prepaidCardMarketV2', this.layer2Web3);
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

  async getPrepaidCardsFromTxn(txnHash: string): Promise<string[]> {
    let prepaidCardMgrAddress = await getAddress('prepaidCardManager', this.layer2Web3);
    let txnReceipt = await waitForTransactionConsistency(this.layer2Web3, txnHash);
    return getParamsFromEvent(this.layer2Web3, txnReceipt, this.createPrepaidCardEventABI(), prepaidCardMgrAddress).map(
      (createCardLog) => createCardLog.card
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
