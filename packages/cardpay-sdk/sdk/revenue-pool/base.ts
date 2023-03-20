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
import { Signer } from 'ethers';

const { fromWei } = Web3.utils;
const POLL_INTERVAL = 500;
const TIMEOUT = 1000 * 60 * 5;

/**
 * @group Cardpay
 */
export interface RevenueTokenBalance {
  tokenSymbol: string;
  tokenAddress: string;
  balance: string; // balance is in native units of the token (e.g. wei)
}

/**
 *
 * The `RevenuePool` API is used register merchants and view/claim merchant revenue from prepaid card payments within the layer 2 network in which the Card Protocol runs. The `RevenuePool` API can be obtained from `getSDK()` with a `Web3` instance that is configured to operate on a layer 2 network (like Gnosis Chain or Sokol).
 * @example
 * ```ts
 * import { getSDK } from "@cardstack/cardpay-sdk";
 * let web3 = new Web3(myProvider); // Layer 2 web3 instance
 * let revenuePool = await getSDK('RevenuePool', web3);
 * ```
 * @group Cardpay
 * @category Main
 */
export default class RevenuePool {
  private revenuePool: Contract | undefined;

  constructor(private layer2Web3: Web3, private layer2Signer?: Signer) {}

  /**
   *
   * This call will return the fee in SPEND to register as a merchant.
   * @returns a promise for a number which represents the amount of SPEND it costs to register as a merchant.
   * @example
   * ```ts
   *   let registrationFeeInSpend = await revenuePool.merchantRegistrationFee();
   *  registrationFee = 1000
   * ```
   */
  async merchantRegistrationFee(): Promise<number> {
    // this is a SPEND amount which is a safe number to represent in javascript
    return Number(await (await this.getRevenuePool()).methods.merchantRegistrationFeeInSPEND().call());
  }

  /**
   *
   * This call returns the balance in the RevenuePool for a merchant's safe address. As customers pay merchants with their prepaid cards, the payments accumulate as revenue that the merchants can claim using their merchant safes. This function reveals the revenue that has accumulated for the merchant. This function takes in a parameter, which is the merchant's safe address and returns a promise that is a list balances aggregated by token address (a merchant can accumulate balances for all the stable coin CPXD tokens that are allowed in the cardpay protocol).
   * @returns he amount of the tokens specified as the token address in the parameters that are estimated to be used to pay for gas as a string in units of `wei`.
   * @example
   * ```ts
   * let balances = await revenuePool.balances(merchantSafeAddress);
   * for (let balanceInfo of balances) {
   *   console.log(`${balanceInfo.tokenSymbol} balance is ${fromWei(balanceInfo.balance)}`)
   * }
   * ```
   */
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

  /**
   *
   * This call will return the gas estimate for claiming revenue.
   * @returns a promise for the amount of the tokens specified as the token address in the parameters that are estimated to be used to pay for gas as a string in units of `wei`
   * @param merchantSafeAddress The merchant's safe address
   * @param tokenAddress The token address of the tokens the merchant is claiming
   * @param amount The amount of tokens that are being claimed as a string in native units of the token (e.g. `wei`)
   * @example
   * ```ts
   * let result = await revenuePool.claimGasEstimate(merchantSafeAddress, tokenAddress, claimAmountInWei);
   * ```
   */
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

  /**
   *
   * This call will transfer unclaimed merchant revenue from the revenue pool into the merchant's safe, thereby "claiming" the merchant's revenue earned from prepaid card payments.
   * @returns This method returns a promise for a web3 transaction receipt
   * @param merchantSafeAddress The merchant's safe address
   * @param tokenAddress The token address of the tokens the merchant is claiming
   * @param amount The amount of tokens that are being claimed as a string in native units of the token (e.g. `wei`)
   * `amount` is an optional param. When `amount` is excluded, the entire `revenueBalance` of a merchant safe is claimed.
   * @example
   * ```ts
   * let result = await revenuePool.claim(merchantSafeAddress, tokenAddress, claimAmountInWei);
   * ```
   */
  async claim(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async claim(
    merchantSafeAddress: string,
    tokenAddress: string,
    amount?: string,
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
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let revenuePoolAddress = await getAddress('revenuePool', this.layer2Web3);
    let revenuePool = new this.layer2Web3.eth.Contract(RevenuePoolABI as AbiItem[], revenuePoolAddress);
    let unclaimedBalance = new BN(await revenuePool.methods.revenueBalance(merchantSafeAddress, tokenAddress).call());
    let weiAmount;
    if (amount) {
      weiAmount = new BN(amount);
      if (unclaimedBalance.lt(weiAmount)) {
        throw new Error(
          `Merchant safe does not have enough unclaimed revenue balance to make this claim. The merchant safe ${merchantSafeAddress} unclaimed balance for token ${tokenAddress} is ${fromWei(
            unclaimedBalance
          )}, amount being claimed is ${fromWei(amount)}`
        );
      }
    } else {
      weiAmount = unclaimedBalance;
    }
    let payload = revenuePool.methods.claimRevenue(tokenAddress, weiAmount).encodeABI();
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
    if (weiAmount.lt(gasCost)) {
      throw new Error(
        `Revenue claim is not enough to cover the gas cost. The revenue amount to be claimed is ${fromWei(
          fromWei(weiAmount)
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
      await signSafeTx(
        this.layer2Web3,
        merchantSafeAddress,
        revenuePoolAddress,
        payload,
        Operation.CALL,
        estimate,
        nonce,
        from,
        this.layer2Signer
      )
    );

    let txnHash = gnosisResult.ethereumTx.txHash;
    if (typeof onTxnHash === 'function') {
      await onTxnHash(txnHash);
    }
    return await waitForTransactionConsistency(this.layer2Web3, txnHash, merchantSafeAddress, nonce);
  }

  /**
   *
   * This call will register a merchant with the Revenue Pool. In order to register as a merchant a prepaid card is used to pay the merchant registration fee. As part of merchant registration a gnosis safe will be created for the merchant specifically to claim revenue from prepaid card payments from the Revenue Pool. When customers pay a merchant they must specify the merchant safe (created from this call) as the recipient for merchant payments.
   * The parameters to this function are:
   * - The merchant's prepaid card address that will be paying the merchant registration fee
   * - The merchant's info DID which is an identifier string that can resolve merchant details like their name, URL, logo, etc.
   * @example
   * ```ts
   *   let { merchantSafe } = await revenuePool.registerMerchant(merchantsPrepaidCardAddress, infoDID);
   * ```
   * This call takes in as a parameter the prepaid card address that the merchant is using to pay the registration fee for becoming a new merchant.
   * @returns promise for a web3 transaction receipt.
   */
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
        await signPrepaidCardSendTx(this.layer2Web3, prepaidCardAddress, payload, nonce, from, this.layer2Signer),
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
