import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { Contract, ContractOptions } from 'web3-eth-contract';
import RevenuePoolABI from '../../contracts/abi/v0.9.0/revenue-pool';
import ERC20ABI from '../../contracts/abi/erc-20';
import { getAddress } from '../../contracts/addresses';
import {
  EventABI,
  getParamsFromEvent,
  SendPayload,
  getSendPayload,
  executeSend,
  GnosisExecTx,
  gasEstimate,
  executeTransaction,
  getNextNonceFromEstimate,
  executeSendWithRateLock,
  Operation,
  gasInToken,
} from '../utils/safe-utils';
import { TransactionOptions, waitForTransactionConsistency, isTransactionHash } from '../utils/general-utils';
import { Signature, signPrepaidCardSendTx, signSafeTx } from '../utils/signing-utils';
import { getSDK } from '../version-resolver';
import BN from 'bn.js';
import type { SuccessfulTransactionReceipt } from '../utils/successful-transaction-receipt';
import { MerchantSafe, Safe } from '../safes';

const { fromWei } = Web3.utils;
const POLL_INTERVAL = 500;
const TIMEOUT = 1000 * 60 * 5;

interface RevenueTokenBalance {
  tokenSymbol: string;
  tokenAddress: string;
  balance: string; // balance is in wei
}

export default class RevenuePool {
  private revenuePool: Contract | undefined;

  constructor(private layer2Web3: Web3) {}

  async merchantRegistrationFee(): Promise<number> {
    // this is a SPEND amount which is a safe number to represent in javascript
    return Number(await (await this.getRevenuePool()).methods.merchantRegistrationFeeInSPEND().call());
  }

  async balances(merchantSafeAddress: string): Promise<RevenueTokenBalance[]> {
    let revenuePool = new this.layer2Web3.eth.Contract(
      RevenuePoolABI as AbiItem[],
      await getAddress('revenuePool', this.layer2Web3)
    );
    let tokenAddresses = (await revenuePool.methods.revenueTokens(merchantSafeAddress).call()) as string[];
    let result = await Promise.all(
      tokenAddresses.map(async (tokenAddress) => {
        const tokenContract = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);
        let [tokenSymbol, balance] = await Promise.all([
          tokenContract.methods.symbol().call() as Promise<string>,
          revenuePool.methods.revenueBalance(merchantSafeAddress, tokenAddress).call() as Promise<string>,
        ]);
        return {
          tokenAddress,
          tokenSymbol,
          balance,
        };
      })
    );
    return result;
  }

  // We'll probably want to add this capability for the other API's...
  // Note that the returned amount is in units of the token specified in the
  // function params, tokenAddress
  async claimGasEstimate(merchantSafeAddress: string, tokenAddress: string, amount: string): Promise<string> {
    let revenuePoolAddress = await getAddress('revenuePool', this.layer2Web3);
    let revenuePool = new this.layer2Web3.eth.Contract(RevenuePoolABI as AbiItem[], revenuePoolAddress);
    let unclaimedBalance = new BN(await revenuePool.methods.revenueBalance(merchantSafeAddress, tokenAddress).call());
    if (unclaimedBalance.lt(new BN(amount))) {
      throw new Error(
        `Merchant safe does not have enough enough unclaimed revenue balance to make this claim. The merchant safe ${merchantSafeAddress} unclaimed balance for token ${tokenAddress} is ${fromWei(
          unclaimedBalance
        )}, amount being claimed is ${fromWei(amount)}`
      );
    }
    let payload = revenuePool.methods.claimRevenue(tokenAddress, amount).encodeABI();
    let estimate = await gasEstimate(
      this.layer2Web3,
      merchantSafeAddress,
      revenuePoolAddress,
      '0',
      payload,
      Operation.CALL,
      tokenAddress
    );
    return gasInToken(estimate).toString();
  }

  async claim(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async claim(
    merchantSafeAddress: string,
    tokenAddress: string,
    amount: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async claim(
    merchantSafeAddressOrTxnHash: string,
    tokenAddress?: string,
    amount?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt> {
    if (isTransactionHash(merchantSafeAddressOrTxnHash)) {
      let txnHash = merchantSafeAddressOrTxnHash;
      return waitForTransactionConsistency(this.layer2Web3, txnHash);
    }
    let merchantSafeAddress = merchantSafeAddressOrTxnHash;
    if (!tokenAddress) {
      throw new Error('tokenAddress is required');
    }
    if (!amount) {
      throw new Error('amount is required');
    }
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let revenuePoolAddress = await getAddress('revenuePool', this.layer2Web3);
    let revenuePool = new this.layer2Web3.eth.Contract(RevenuePoolABI as AbiItem[], revenuePoolAddress);
    let unclaimedBalance = new BN(await revenuePool.methods.revenueBalance(merchantSafeAddress, tokenAddress).call());
    if (unclaimedBalance.lt(new BN(amount))) {
      throw new Error(
        `Merchant safe does not have enough unclaimed revenue balance to make this claim. The merchant safe ${merchantSafeAddress} unclaimed balance for token ${tokenAddress} is ${fromWei(
          unclaimedBalance
        )}, amount being claimed is ${fromWei(amount)}`
      );
    }
    let payload = revenuePool.methods.claimRevenue(tokenAddress, amount).encodeABI();
    let estimate = await gasEstimate(
      this.layer2Web3,
      merchantSafeAddress,
      revenuePoolAddress,
      '0',
      payload,
      Operation.CALL,
      tokenAddress
    );
    let gasCost = gasInToken(estimate);
    if (new BN(amount).lt(gasCost)) {
      throw new Error(
        `Revenue claim is not enough to cover the gas cost. The revenue amount to be claimed is ${fromWei(
          amount
        )}, the gas cost is ${fromWei(gasCost)}`
      );
    }
    if (nonce == null) {
      nonce = getNextNonceFromEstimate(estimate);
      if (typeof onNonce === 'function') {
        onNonce(nonce);
      }
    }
    let gnosisResult = await executeTransaction(
      this.layer2Web3,
      merchantSafeAddress,
      revenuePoolAddress,
      payload,
      Operation.CALL,
      estimate,
      nonce,
      await signSafeTx(this.layer2Web3, merchantSafeAddress, revenuePoolAddress, payload, estimate, nonce, from)
    );

    let txnHash = gnosisResult.ethereumTx.txHash;
    if (typeof onTxnHash === 'function') {
      await onTxnHash(txnHash);
    }
    return await waitForTransactionConsistency(this.layer2Web3, txnHash, merchantSafeAddress, nonce);
  }

  async registerMerchant(
    txnHash: string
  ): Promise<{ merchantSafe: MerchantSafe; txReceipt: SuccessfulTransactionReceipt }>;
  async registerMerchant(
    prepaidCardAddress: string,
    infoDID: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<{ merchantSafe: MerchantSafe; txReceipt: SuccessfulTransactionReceipt }>;
  async registerMerchant(
    prepaidCardAddressOrTxnHash: string,
    infoDID?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<{ merchantSafe: MerchantSafe; txReceipt: SuccessfulTransactionReceipt }> {
    if (isTransactionHash(prepaidCardAddressOrTxnHash)) {
      let txnHash = prepaidCardAddressOrTxnHash;
      let merchantSafeAddress = await this.getMerchantSafeFromTxn(txnHash);
      return {
        merchantSafe: await this.resolveMerchantSafe(merchantSafeAddress),
        txReceipt: await waitForTransactionConsistency(this.layer2Web3, txnHash),
      };
    }
    let prepaidCardAddress = prepaidCardAddressOrTxnHash;
    if (!infoDID) {
      throw new Error('infoDID is required');
    }
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let prepaidCard = await getSDK('PrepaidCard', this.layer2Web3);
    let registrationFee = await this.merchantRegistrationFee();
    infoDID = infoDID ?? '';
    await prepaidCard.convertFromSpendForPrepaidCard(
      prepaidCardAddress,
      registrationFee,
      (issuingToken, balanceAmount, requiredTokenAmount, symbol) =>
        new Error(
          `Prepaid card does not have enough balance to register a merchant. The issuing token ${issuingToken} balance of prepaid card ${prepaidCardAddress} is ${fromWei(
            balanceAmount.toString()
          )} ${symbol}, payment amount in issuing token is ${fromWei(requiredTokenAmount)} ${symbol}`
        )
    );

    let gnosisResult = await executeSendWithRateLock(this.layer2Web3, prepaidCardAddress, async (rateLock) => {
      let payload = await this.getRegisterMerchantPayload(prepaidCardAddress, registrationFee, rateLock, infoDID!);
      if (nonce == null) {
        nonce = getNextNonceFromEstimate(payload);
        if (typeof onNonce === 'function') {
          onNonce(nonce);
        }
      }
      return await this.executeRegisterMerchant(
        prepaidCardAddress,
        registrationFee,
        rateLock,
        infoDID!,
        payload,
        await signPrepaidCardSendTx(this.layer2Web3, prepaidCardAddress, payload, nonce, from),
        nonce
      );
    });

    if (!gnosisResult) {
      throw new Error(`Unable to register merchant with prepaid card ${prepaidCardAddress}`);
    }

    let txnHash = gnosisResult.ethereumTx.txHash;

    if (typeof onTxnHash === 'function') {
      await onTxnHash(txnHash);
    }

    let merchantSafeAddress = await this.getMerchantSafeFromTxn(txnHash);
    return {
      merchantSafe: await this.resolveMerchantSafe(merchantSafeAddress),
      txReceipt: await waitForTransactionConsistency(this.layer2Web3, txnHash, prepaidCardAddress, nonce!),
    };
  }

  private async getRevenuePool(): Promise<Contract> {
    if (this.revenuePool) {
      return this.revenuePool;
    }
    this.revenuePool = new this.layer2Web3.eth.Contract(
      RevenuePoolABI as AbiItem[],
      await getAddress('revenuePool', this.layer2Web3)
    );
    return this.revenuePool;
  }

  private async getMerchantSafeFromTxn(txnHash: string): Promise<string> {
    let merchantManager = await getAddress('merchantManager', this.layer2Web3);
    let txnReceipt = await waitForTransactionConsistency(this.layer2Web3, txnHash);
    return getParamsFromEvent(this.layer2Web3, txnReceipt, this.createMerchantEventABI(), merchantManager)[0]
      ?.merchantSafe;
  }

  private async getRegisterMerchantPayload(
    prepaidCardAddress: string,
    spendAmount: number,
    rate: string,
    infoDID: string
  ): Promise<SendPayload> {
    return getSendPayload(
      this.layer2Web3,
      prepaidCardAddress,
      spendAmount,
      rate,
      'registerMerchant',
      this.layer2Web3.eth.abi.encodeParameters(['string'], [infoDID])
    );
  }

  private async resolveMerchantSafe(merchantSafeAddress: string): Promise<MerchantSafe> {
    let safes = await getSDK('Safes', this.layer2Web3);
    let startTime = Date.now();
    let merchantSafe: Safe | undefined;
    let isFirstTime = true;

    do {
      if (!isFirstTime) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
      }
      isFirstTime = false;
      merchantSafe = (await safes.viewSafe(merchantSafeAddress)).safe;
    } while (merchantSafe?.type !== 'merchant' && Date.now() - startTime < TIMEOUT);
    if (!merchantSafe) {
      throw new Error(`Timeout while waiting for the merchant safe to be created.`);
    }
    if (merchantSafe.type !== 'merchant') {
      throw new Error(`Safe ${merchantSafeAddress} is not a merchant safe.`);
    }
    return merchantSafe;
  }

  private async executeRegisterMerchant(
    prepaidCardAddress: string,
    spendAmount: number,
    rate: string,
    infoDID: string,
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
      'registerMerchant',
      this.layer2Web3.eth.abi.encodeParameters(['string'], [infoDID]),
      signatures,
      nonce
    );
  }

  private createMerchantEventABI(): EventABI {
    return {
      topic: this.layer2Web3.eth.abi.encodeEventSignature('MerchantCreation(address,address,string)'),
      abis: [
        {
          type: 'address',
          name: 'merchant',
        },
        {
          type: 'address',
          name: 'merchantSafe',
        },
        {
          type: 'string',
          name: 'infoDID',
        },
      ],
    };
  }
}
