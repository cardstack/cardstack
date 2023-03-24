import Web3 from 'web3';
import RewardSafeDelegateABI from '../../contracts/abi/v0.9.0/reward-safe-delegate-implementation';
import PrepaidCardManagerABI from '../../contracts/abi/v0.9.0/prepaid-card-manager';
import RewardManagerABI from '../../contracts/abi/v0.9.0/reward-manager';
import { Contract, ContractOptions } from 'web3-eth-contract';
import { getAddress } from '../../contracts/addresses';
import { AbiItem, randomHex, toChecksumAddress, fromWei } from 'web3-utils';
import {
  isTransactionHash,
  TransactionOptions,
  waitForTransactionConsistency,
  resolveDoc,
} from '../utils/general-utils';
import { getSDK } from '../version-resolver';
import type { SuccessfulTransactionReceipt } from '../utils/successful-transaction-receipt';
import {
  EventABI,
  getParamsFromEvent,
  SendPayload,
  getSendPayload,
  getNextNonceFromEstimate,
  executeSendWithRateLock,
  GnosisExecTx,
  executeSend,
  gasEstimate,
  executeTransaction,
  Operation,
  gasInToken,
  GasEstimate,
  baseGasBuffer,
} from '../utils/safe-utils';
import { Signature, signPrepaidCardSendTx } from '../utils/signing-utils';
import BN from 'bn.js';
import ERC20ABI from '../../contracts/abi/erc-20';
import { signRewardSafe, createEIP1271VerifyingData } from '../utils/signing-utils';
import { ZERO_ADDRESS } from '../constants';
// eslint-disable-next-line node/no-extraneous-import
import { WithSymbol, RewardTokenBalance } from '@cardstack/cardpay-sdk';
import { query } from '../utils/graphql';
import { Signer } from 'ethers';
import { get } from 'lodash';

/**
 * @group Cardpay
 */
export interface RewardProgramInfo {
  rewardProgramId: string;
  rewardProgramAdmin: string;
  locked: boolean;
  blob: string;
  tokenBalances: WithSymbol<RewardTokenBalance>[];
  programExplainer: string;
}

/**
 * @group Cardpay
 */
export interface RuleJson {
  explanation: any;
  rules: any[];
}

const rewardProgramQuery = `
  query {
    rewardPrograms {
      id
    }
    _meta {
       block {
         number
       }
     }
  }
`;

/**
 *
 * The `RewardManager` API is used to interact to manage reward program. Those intending to offer or receive rewards have to register using this sdk.
 *  @group Cardpay
 *  @category Main
 */
export default class RewardManager {
  private rewardManager: Contract | undefined;
  private rewardSafeDelegate: Contract | undefined;

  constructor(private layer2Web3: Web3, private layer2Signer?: Signer) {}

  /**
   * The `RegisterRewardProgram` API is used to register a reward program using a prepaid card. The call can specify an EOA admin account -- it defaults to the owner of the prepaid card itself. The reward program admin will then be able to manage the reward program using other api functions like`lockRewardProgram`, `addRewardRule`, `updateRewardProgramAdmin`. A fee of 500 spend is charged when registering a reward program. Currently, tally only gives rewards to a single reward program (sokol: "0x4767D0D74356433d54880Fcd7f083751d64388aF").
   * @example
   * ```ts
   * let rewardManagerAPI = await getSDK('RewardManager', web3);
   * await rewardManagerAPI.registerRewardProgram(prepaidCard, admin)
   * ```
   */
  async registerRewardProgram(
    txnHash: string
  ): Promise<{ rewardProgramId: string; txReceipt: SuccessfulTransactionReceipt }>;
  async registerRewardProgram(
    prepaidCardAddress: string,
    admin: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<{ rewardProgramId: string; txReceipt: SuccessfulTransactionReceipt }>;
  async registerRewardProgram(
    prepaidCardAddressOrTxnHash: string,
    admin?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<{ rewardProgramId: string; txReceipt: SuccessfulTransactionReceipt }> {
    let rewardManager = await getSDK('RewardManager', this.layer2Web3);
    let rewardProgramId = await rewardManager.newRewardProgramId();
    if (isTransactionHash(prepaidCardAddressOrTxnHash)) {
      let txnHash = prepaidCardAddressOrTxnHash;
      return {
        rewardProgramId,
        txReceipt: await waitForTransactionConsistency(this.layer2Web3, txnHash),
      };
    }
    if (!prepaidCardAddressOrTxnHash) {
      throw new Error('prepaidCardAddress is required');
    }
    let prepaidCardAddress = prepaidCardAddressOrTxnHash;
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let rewardProgramRegistrationFees = await rewardManager.getRewardProgramRegistrationFees();
    let prepaidCardAPI = await getSDK('PrepaidCard', this.layer2Web3);
    await prepaidCardAPI.convertFromSpendForPrepaidCard(
      prepaidCardAddress,
      rewardProgramRegistrationFees,
      (issuingToken, balanceAmount, requiredTokenAmount, symbol) =>
        new Error(
          `Prepaid card does not have enough balance to register reward program. The issuing token ${issuingToken} balance of prepaid card ${prepaidCardAddress} is ${fromWei(
            balanceAmount
          )} ${symbol}, payment amount in issuing token is ${fromWei(requiredTokenAmount)} ${symbol}`
        )
    );

    let prepaidCardMgr = await prepaidCardAPI.getPrepaidCardMgr();
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
        await signPrepaidCardSendTx(this.layer2Web3, prepaidCardAddress, payload, nonce, from, this.layer2Signer),
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
      txReceipt: await waitForTransactionConsistency(this.layer2Web3, txnHash, prepaidCardAddress, nonce!),
    };
  }

  /**
   * The `RegisterRewardee` API is used to register a rewardee for a reward program using a prepaid card. The purpose of registering is not to "be considered to receive rewards" rather to "be able to claim rewards that have been given". By registering, the owner of the prepaid card is given ownership of a reward safe that will be used to retrieve rewards from the reward pool. A rewardee/eoa is eligible to only have one reward safe for each reward program; any attempts to re-register will result in a revert error. There is no fee in registering a reward safe, the prepaid card will pay the gas fees to execute the transaction.
   *
   * @example
   * ```ts
   * let rewardManagerAPI = await getSDK(RewardManager, web3);
   * await rewardManagerAPI.registerRewardee(prepaidCard , rewardProgramId)
   * ```
   */
  async registerRewardee(txnHash: string): Promise<{ rewardSafe: string; txReceipt: SuccessfulTransactionReceipt }>;
  async registerRewardee(
    prepaidCardAddress: string,
    rewardProgramId: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<{ rewardSafe: string; txReceipt: SuccessfulTransactionReceipt }>;
  async registerRewardee(
    prepaidCardAddressOrTxnHash: string,
    rewardProgramId?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<{ rewardSafe: string; txReceipt: SuccessfulTransactionReceipt }> {
    if (isTransactionHash(prepaidCardAddressOrTxnHash)) {
      let txnHash = prepaidCardAddressOrTxnHash;
      return {
        rewardSafe: await this.getRewardSafeFromTxn(txnHash),
        txReceipt: await waitForTransactionConsistency(this.layer2Web3, txnHash),
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
        await signPrepaidCardSendTx(this.layer2Web3, prepaidCardAddress, payload, nonce, from, this.layer2Signer),
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
      txReceipt: await waitForTransactionConsistency(this.layer2Web3, txnHash, prepaidCardAddress, nonce!),
    };
  }

  /**
   * The `registerRewardeeGasEstimate` returns a gas estimate for the prepaid card send transaction when registering a rewardee.
   * @example
   * ```ts
   * let rewardManagerAPI = await getSDK('RewardManager', web3);
   * await rewardManagerAPI.registerRewardeeGasEstimate(prepaidCard, rewardProgramId)
   * ```
   */
  async registerRewardeeGasEstimate(prepaidCardAddress: string, rewardProgramId: string): Promise<GasEstimate> {
    let layerTwoOracle = await getSDK('LayerTwoOracle', this.layer2Web3);
    let prepaidCardManager = new this.layer2Web3.eth.Contract(
      PrepaidCardManagerABI as AbiItem[],
      await getAddress('prepaidCardManager', this.layer2Web3)
    );
    let issuingToken = (await prepaidCardManager.methods.cardDetails(prepaidCardAddress).call()).issueToken;
    let rateLock = await layerTwoOracle.getRateLock(issuingToken);
    let payload = await this.getRegisterRewardeePayload(prepaidCardAddress, rewardProgramId, rateLock);
    return {
      gasToken: payload.gasToken,
      amount: gasInToken(payload),
    };
  }

  /**
   * The `LockRewardProgram` API is used to to lock a reward program using a prepaid card. When a reward program is locked, tally will choose to stop calculating rewards for reward reward program from that point forward. This doesn't stop the unclaimed rewards from being claimed, i.e. unused proofs. The prepaid card will pay for the gas fees to execute the transaction. Only the reward program admin can call this function. Executing this function again will unlock the reward program, which will allow tally to restart calculating rewards.
   * @example
   * ```ts
   * let rewardManagerAPI = await getSDK(RewardManager, web3);
   * await rewardManagerAPI.lockRewardProgram(prepaidCard , rewardProgramId)
   * ```
   * @group Cardpay
   */
  async lockRewardProgram(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async lockRewardProgram(
    prepaidCardAddress: string,
    rewardProgramId: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async lockRewardProgram(
    prepaidCardAddressOrTxnHash: string,
    rewardProgramId?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt> {
    if (isTransactionHash(prepaidCardAddressOrTxnHash)) {
      let txnHash = prepaidCardAddressOrTxnHash;
      return await waitForTransactionConsistency(this.layer2Web3, txnHash);
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

    await this.checkPrepaidCardOwnerIsAdmin(rewardProgramId, prepaidCardAddress);

    let gnosisResult = await executeSendWithRateLock(this.layer2Web3, prepaidCardAddress, async (rateLock) => {
      let payload = await this.getLockRewardProgramPayload(prepaidCardAddress, rewardProgramId, rateLock);
      if (nonce == null) {
        nonce = getNextNonceFromEstimate(payload);
        if (typeof onNonce === 'function') {
          onNonce(nonce);
        }
      }
      return await this.executeLockRewardProgram(
        prepaidCardAddress,
        rewardProgramId,
        rateLock,
        payload,
        await signPrepaidCardSendTx(this.layer2Web3, prepaidCardAddress, payload, nonce, from, this.layer2Signer),
        nonce
      );
    });

    if (!gnosisResult) {
      throw new Error(
        `Unable to obtain a gnosis transaction result for lock reward program from prepaid card ${prepaidCardAddress}`
      );
    }

    let txnHash = gnosisResult.ethereumTx.txHash;

    if (typeof onTxnHash === 'function') {
      await onTxnHash(txnHash);
    }
    return await waitForTransactionConsistency(this.layer2Web3, txnHash, prepaidCardAddress, nonce!);
  }

  /**
   * The `UpdateRewardProgramAdmin` API is used to update the reward program admin of a reward program using a prepaid card. The prepaid card will pay for the gas fees to execute the transaction. Only the reward program admin can call this function.
   * @example
   * ```ts
   * let rewardManagerAPI = await getSDK(RewardManager, web3);
   * await rewardManagerAPI.updateRewardProgramAdmin(prepaidCard , rewardProgramId, newAdmin)
   * ```
   */
  async updateRewardProgramAdmin(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async updateRewardProgramAdmin(
    prepaidCardAddress: string,
    rewardProgramId: string,
    newAdmin: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async updateRewardProgramAdmin(
    prepaidCardAddressOrTxnHash: string,
    rewardProgramId?: string,
    newAdmin?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt> {
    if (isTransactionHash(prepaidCardAddressOrTxnHash)) {
      let txnHash = prepaidCardAddressOrTxnHash;
      return await waitForTransactionConsistency(this.layer2Web3, txnHash);
    }
    if (!prepaidCardAddressOrTxnHash) {
      throw new Error('prepaidCardAddress is required');
    }
    if (!rewardProgramId) {
      throw new Error('rewardProgramId is required');
    }
    if (!newAdmin) {
      throw new Error('newAdmin is required');
    }
    let prepaidCardAddress = prepaidCardAddressOrTxnHash;
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];

    await this.checkPrepaidCardOwnerIsAdmin(rewardProgramId, prepaidCardAddress);

    let gnosisResult = await executeSendWithRateLock(this.layer2Web3, prepaidCardAddress, async (rateLock) => {
      let payload = await this.getUpdateRewardProgramAdminPayload(
        prepaidCardAddress,
        rewardProgramId,
        newAdmin,
        rateLock
      );
      if (nonce == null) {
        nonce = getNextNonceFromEstimate(payload);
        if (typeof onNonce === 'function') {
          onNonce(nonce);
        }
      }
      return await this.executeUpdateRewardProgramAdmin(
        prepaidCardAddress,
        rewardProgramId,
        newAdmin,
        rateLock,
        payload,
        await signPrepaidCardSendTx(this.layer2Web3, prepaidCardAddress, payload, nonce, from, this.layer2Signer),
        nonce
      );
    });

    if (!gnosisResult) {
      throw new Error(
        `Unable to obtain a gnosis transaction result for update reward program admin from prepaid card ${prepaidCardAddress}`
      );
    }

    let txnHash = gnosisResult.ethereumTx.txHash;

    if (typeof onTxnHash === 'function') {
      await onTxnHash(txnHash);
    }
    return await waitForTransactionConsistency(this.layer2Web3, txnHash, prepaidCardAddress, nonce!);
  }

  /**
   *
   * The `AddRewardRule` API is used to add a reward rule for a reward program using a prepaid card. The reward rule is specified as a blob of bytes which tally will parse to understand how to compute rewards for the reward program. Each reward program will only ever have a single reward rule -- a single blob. The prepaid card will pay for the gas fees to execute the transaction. Only the reward program admin can call this function.
   * @example
   * ```ts
   * let rewardManagerAPI = await getSDK('RewardManager', web3);
   * await rewardManagerAPI.addRewardRule(prepaidCard, rewardProgramId, blob)
   * ```
   */
  async addRewardRule(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async addRewardRule(
    prepaidCardAddress: string,
    rewardProgramId: string,
    blob: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async addRewardRule(
    prepaidCardAddressOrTxnHash: string,
    rewardProgramId?: string,
    blob?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt> {
    if (isTransactionHash(prepaidCardAddressOrTxnHash)) {
      let txnHash = prepaidCardAddressOrTxnHash;
      return await waitForTransactionConsistency(this.layer2Web3, txnHash);
    }
    if (!prepaidCardAddressOrTxnHash) {
      throw new Error('prepaidCardAddress is required');
    }
    if (!rewardProgramId) {
      throw new Error('rewardProgramId is required');
    }
    if (!blob) {
      throw new Error('blob is required');
    }
    let prepaidCardAddress = prepaidCardAddressOrTxnHash;
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];

    await this.checkPrepaidCardOwnerIsAdmin(rewardProgramId, prepaidCardAddress);

    let gnosisResult = await executeSendWithRateLock(this.layer2Web3, prepaidCardAddress, async (rateLock) => {
      let payload = await this.getAddRewardRulePayload(prepaidCardAddress, rewardProgramId, blob, rateLock);
      if (nonce == null) {
        nonce = getNextNonceFromEstimate(payload);
        if (typeof onNonce === 'function') {
          onNonce(nonce);
        }
      }
      return await this.executeAddRewardRule(
        prepaidCardAddress,
        rewardProgramId,
        blob,
        rateLock,
        payload,
        await signPrepaidCardSendTx(this.layer2Web3, prepaidCardAddress, payload, nonce, from, this.layer2Signer),
        nonce
      );
    });

    if (!gnosisResult) {
      throw new Error(
        `Unable to obtain a gnosis transaction result for lock reward program from prepaid card ${prepaidCardAddress}`
      );
    }

    let txnHash = gnosisResult.ethereumTx.txHash;

    if (typeof onTxnHash === 'function') {
      await onTxnHash(txnHash);
    }
    return await waitForTransactionConsistency(this.layer2Web3, txnHash, prepaidCardAddress, nonce!);
  }
  /**
   *
   * The `Withdraw` API is used to withdraw ERC677 tokens earned in a reward safe to any other destination address -- it is simlar to a transfer function. The gas fees in the withdrawal will be paid out of the balance of the safe -- similar to `Safe.sendTokens`.
   *
   * `amount` is an optional param. When `amount` is included, one must ensure that there is sufficient balance leftover to pay for gas of the transaction, .i.e `safeBalance < amount - estimatedGasCost`. The scenario which this occurs is when the user specifies `amount` that is close to `safeBalance`. The client should make this check. When `amount` is excluded, the whole balance of the safe is withdrawn which is automatically taxed for gas, .i.e the gas deduction occurs internally within the sdk function. It is recommended when the client expects to withdraw the "max" balance that it doesn't specify `amount`.
   * @example
   * ```ts
   * let rewardManagerAPI = await getSDK(RewardManager, web3);
   *  await rewardManagerAPI.withdraw(rewardSafe , to, token, amount)
   * ```
   */
  async withdraw(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async withdraw(
    safeAddress: string,
    to: string,
    tokenAddress: string,
    amount?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async withdraw(
    safeAddressOrTxnHash: string,
    to?: string,
    tokenAddress?: string,
    amount?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt> {
    if (isTransactionHash(safeAddressOrTxnHash)) {
      let txnHash = safeAddressOrTxnHash;
      return await waitForTransactionConsistency(this.layer2Web3, txnHash);
    }
    if (!safeAddressOrTxnHash) {
      throw new Error('safeAddress is required');
    }
    if (!tokenAddress) {
      throw new Error('tokenAddress must be provided');
    }
    if (!to) {
      throw new Error('to must be provided');
    }
    let safeAddress = safeAddressOrTxnHash;

    let rewardManager = await getSDK('RewardManager', this.layer2Web3);
    let rewardManagerAddress = await this.address();

    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let rewardSafeOwner = await rewardManager.getRewardSafeOwner(safeAddress);

    let token = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);
    let safeBalance = new BN(await token.methods.balanceOf(safeAddress).call());

    let rewardSafeDelegateAddress = await this.getRewardSafeDelegateAddress();
    if (!(rewardSafeOwner == from)) {
      throw new Error(
        `Reward safe owner is NOT the signer of transaction.
The owner of reward safe ${safeAddress} is ${rewardSafeOwner}, but the signer is ${from}`
      );
    }

    let estimate;
    let withdrawPayload;
    if (amount) {
      let weiAmount = new BN(amount);
      if (weiAmount.gt(safeBalance)) {
        throw new Error(
          `Insufficient funds inside reward safe. safeBalance = ${fromWei(safeBalance)} and amount = ${fromWei(amount)}`
        );
      }
      withdrawPayload = await this.getWithdrawPayload(tokenAddress, to, weiAmount);

      estimate = await gasEstimate(
        this.layer2Web3,
        safeAddress,
        rewardSafeDelegateAddress,
        '0',
        withdrawPayload,
        Operation.DELEGATECALL,
        tokenAddress
      );
      let gasCost = gasInToken(estimate);
      if (safeBalance.lt(gasCost.add(weiAmount))) {
        throw new Error(
          `Reward safe does not have enough to pay for gas when withdrawing rewards. The reward safe ${safeAddress} balance for token ${tokenAddress} is ${fromWei(
            safeBalance
          )}, amount being withdrawn is ${fromWei(amount)}, the gas cost is ${fromWei(gasCost)}`
        );
      }
    } else {
      //when amount is NOT given, we use safeBalance - gasCost as the withdraw amount
      //Note: gasCost is estimated with safeBalance not the actual withdraw amount
      let preWithdrawPayload = await this.getWithdrawPayload(tokenAddress, to, safeBalance);
      // The preEstimate is used to estimate the gasCost to check that the safeBalance has sufficient leftover to pay for gas after withdrawing a specified amount
      // The preEstimate is typically used when withdrawing full balances from a safe
      let preEstimate = await gasEstimate(
        this.layer2Web3,
        safeAddress,
        rewardSafeDelegateAddress,
        '0',
        preWithdrawPayload,
        Operation.DELEGATECALL,
        tokenAddress
      );
      preEstimate.baseGas = new BN(preEstimate.baseGas).add(baseGasBuffer).toString();
      let gasCost = gasInToken(preEstimate);
      if (safeBalance.lt(gasCost)) {
        throw new Error(
          `Reward safe does not have enough to pay for gas when withdrawing rewards. The reward safe ${safeAddress} balance for token ${tokenAddress} is ${fromWei(
            safeBalance
          )}, the gas cost is ${fromWei(gasCost)}`
        );
      }
      let weiAmount = safeBalance.sub(gasCost);
      withdrawPayload = await this.getWithdrawPayload(tokenAddress, to, weiAmount);
      // We must still compute a new gasEstimate based upon the adjusted amount for gas
      // This is beecause the relayer will do the estimation with the same exact parameters
      // and check that the gas estimates here are at least greater than its own gas estimates
      estimate = await gasEstimate(
        this.layer2Web3,
        safeAddress,
        rewardSafeDelegateAddress,
        '0',
        withdrawPayload,
        Operation.DELEGATECALL,
        tokenAddress
      );
    }

    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    if (nonce == null) {
      nonce = getNextNonceFromEstimate(estimate);
      if (typeof onNonce === 'function') {
        onNonce(nonce);
      }
    }

    let fullSignature = await signRewardSafe(
      this.layer2Web3,
      rewardSafeDelegateAddress,
      0,
      withdrawPayload,
      Operation.DELEGATECALL,
      estimate,
      tokenAddress,
      ZERO_ADDRESS,
      nonce,
      rewardSafeOwner,
      safeAddress,
      rewardManagerAddress,
      this.layer2Signer
    );

    let eip1271Data = createEIP1271VerifyingData(
      this.layer2Web3,
      rewardSafeDelegateAddress,
      '0',
      withdrawPayload,
      Operation.DELEGATECALL.toString(),
      estimate.safeTxGas,
      estimate.baseGas,
      estimate.gasPrice,
      tokenAddress,
      ZERO_ADDRESS,
      nonce.toString()
    );
    let gnosisTxn = await executeTransaction(
      this.layer2Web3,
      safeAddress,
      rewardSafeDelegateAddress,
      withdrawPayload,
      Operation.DELEGATECALL,
      estimate,
      nonce,
      fullSignature,
      { eip1271Data }
    );
    if (typeof onTxnHash === 'function') {
      await onTxnHash(gnosisTxn.ethereumTx.txHash);
    }
    return await waitForTransactionConsistency(this.layer2Web3, gnosisTxn.ethereumTx.txHash, safeAddress, nonce);
  }

  /**
   *
   * The `withdrawGasEstimate` returns a gas estimate for withdrawing a reward.
   * @example
   * ```ts
   * let rewardManagerAPI = await getSDK('RewardManager', web3);
   * await rewardManagerAPI.withdrawGasEstimate(rewardSafeAddress, to, tokenAddress, amount)
   * ```
   */
  async withdrawGasEstimate(
    rewardSafeAddress: string,
    to: string,
    tokenAddress: string,
    amount: string
  ): Promise<GasEstimate> {
    let rewardManagerAddress = await this.address();
    let rewardSafeDelegateAddress = await this.getRewardSafeDelegateAddress();
    let weiAmount = new BN(amount);
    let withdraw = await (
      await this.getRewardSafeDelegate()
    ).methods.withdraw(rewardManagerAddress, tokenAddress, to, weiAmount);
    let token = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);
    let safeBalance = new BN(await token.methods.balanceOf(rewardSafeAddress).call());
    if (safeBalance.lt(weiAmount)) {
      throw new Error(
        `Gas Estimate: Reward safe does not have enough balance to withdraw. The rewardSafe safe ${rewardSafeAddress} balance for token ${tokenAddress} is ${fromWei(
          safeBalance
        )}, amount withdrawn is ${fromWei(weiAmount)}`
      );
    }
    let withdrawPayload = withdraw.encodeABI();
    let estimate = await gasEstimate(
      this.layer2Web3,
      rewardSafeAddress,
      rewardSafeDelegateAddress,
      '0',
      withdrawPayload,
      Operation.DELEGATECALL,
      tokenAddress
    );
    return {
      gasToken: estimate.gasToken,
      amount: gasInToken(estimate),
    };
  }

  async transfer(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async transfer(
    safeAddress: string,
    newOwner: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async transfer(
    safeAddressOrTxnHash: string,
    newOwner?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt> {
    if (isTransactionHash(safeAddressOrTxnHash)) {
      let txnHash = safeAddressOrTxnHash;
      return await waitForTransactionConsistency(this.layer2Web3, txnHash);
    }
    if (!safeAddressOrTxnHash) {
      throw new Error('safeAddress is required');
    }
    if (!newOwner) {
      throw new Error('newOwner must be provided');
    }
    let safeAddress = safeAddressOrTxnHash;

    let rewardManager = await getSDK('RewardManager', this.layer2Web3);
    let rewardManagerAddress = await this.address();

    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let rewardSafeOwner = await rewardManager.getRewardSafeOwner(safeAddress);

    let rewardProgramId = await this.getRewardProgram('0x853fD3376b6f0b2b839Bd841FbdC6C1f93B3BFBD');
    if (rewardProgramId == ZERO_ADDRESS) {
      throw new Error('reward safe does not does not have reward program');
    }
    if (!(await this.isValidRewardSafe(safeAddress, rewardProgramId))) {
      throw new Error('reward safe is not valid');
    }
    // Temporarily, transfer function will use card as a the default gas token
    // This means that the safe has to have card tokens within it before it can transfer
    // This will change after we finalise the gas policy
    let gasTokenAddress = await getAddress('cardCpxd', this.layer2Web3);
    let gasToken = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], gasTokenAddress);

    let safeBalance = new BN(await gasToken.methods.balanceOf(safeAddress).call());

    let rewardSafeDelegateAddress = await this.getRewardSafeDelegateAddress();
    let rewardSafeDelegate = new this.layer2Web3.eth.Contract(
      RewardSafeDelegateABI as AbiItem[],
      rewardSafeDelegateAddress
    );
    if (!(rewardSafeOwner == from)) {
      throw new Error(
        `Reward safe owner is NOT the signer of transaction.
The owner of reward safe ${safeAddress} is ${rewardSafeOwner}, but the signer is ${from}`
      );
    }
    let payload = await rewardSafeDelegate.methods
      .swapOwner(rewardManagerAddress, rewardManagerAddress, rewardSafeOwner, newOwner)
      .encodeABI();
    let estimate = await gasEstimate(
      this.layer2Web3,
      safeAddress,
      rewardSafeDelegateAddress,
      '0',
      payload,
      Operation.DELEGATECALL,
      gasTokenAddress
    );

    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    if (nonce == null) {
      nonce = getNextNonceFromEstimate(estimate);
      if (typeof onNonce === 'function') {
        onNonce(nonce);
      }
    }

    let gasCost = new BN(estimate.safeTxGas).add(new BN(estimate.baseGas)).mul(new BN(estimate.gasPrice));
    if (safeBalance.lt(gasCost)) {
      throw new Error(
        `Reward safe does not have enough to pay for gas when claiming rewards. The reward safe ${safeAddress} balance for token ${gasTokenAddress} is ${fromWei(
          safeBalance
        )}, the gas cost is ${fromWei(gasCost)}`
      );
    }
    let fullSignature = await signRewardSafe(
      this.layer2Web3,
      rewardSafeDelegateAddress,
      0,
      payload,
      Operation.DELEGATECALL,
      estimate,
      gasTokenAddress,
      ZERO_ADDRESS,
      nonce,
      rewardSafeOwner,
      safeAddress,
      rewardManagerAddress,
      this.layer2Signer
    );

    let eip1271Data = createEIP1271VerifyingData(
      this.layer2Web3,
      rewardSafeDelegateAddress,
      '0',
      payload,
      Operation.DELEGATECALL.toString(),
      estimate.safeTxGas,
      estimate.baseGas,
      estimate.gasPrice,
      gasTokenAddress,
      ZERO_ADDRESS,
      nonce.toString()
    );
    let gnosisTxn = await executeTransaction(
      this.layer2Web3,
      safeAddress,
      rewardSafeDelegateAddress,
      payload,
      Operation.DELEGATECALL,
      estimate,
      nonce,
      fullSignature,
      { eip1271Data }
    );
    if (typeof onTxnHash === 'function') {
      await onTxnHash(gnosisTxn.ethereumTx.txHash);
    }
    return await waitForTransactionConsistency(this.layer2Web3, gnosisTxn.ethereumTx.txHash, safeAddress, nonce);
  }

  private async getWithdrawPayload(tokenAddress: string, to: string, weiAmount: BN): Promise<string> {
    let rewardManagerAddress = await this.address();
    let rewardSafeDelegate = await this.getRewardSafeDelegate();
    let withdraw = await rewardSafeDelegate.methods.withdraw(rewardManagerAddress, tokenAddress, to, weiAmount);
    return withdraw.encodeABI();
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

  private async getLockRewardProgramPayload(
    prepaidCardAddress: string,
    rewardProgramId: string,
    rate: string
  ): Promise<SendPayload> {
    return getSendPayload(
      this.layer2Web3,
      prepaidCardAddress,
      0,
      rate,
      'lockRewardProgram',
      this.layer2Web3.eth.abi.encodeParameters(['address'], [rewardProgramId])
    );
  }

  private async getUpdateRewardProgramAdminPayload(
    prepaidCardAddress: string,
    rewardProgramId: string,
    newAdmin: string,
    rate: string
  ): Promise<SendPayload> {
    return getSendPayload(
      this.layer2Web3,
      prepaidCardAddress,
      0,
      rate,
      'updateRewardProgramAdmin',
      this.layer2Web3.eth.abi.encodeParameters(['address', 'address'], [rewardProgramId, newAdmin])
    );
  }

  private async getAddRewardRulePayload(
    prepaidCardAddress: string,
    rewardProgramId: string,
    blob: string,
    rate: string
  ): Promise<SendPayload> {
    return getSendPayload(
      this.layer2Web3,
      prepaidCardAddress,
      0,
      rate,
      'addRewardRule',
      this.layer2Web3.eth.abi.encodeParameters(['address', 'bytes'], [rewardProgramId, blob])
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

  private async executeLockRewardProgram(
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
      'lockRewardProgram',
      this.layer2Web3.eth.abi.encodeParameters(['address'], [rewardProgramId]),
      signatures,
      nonce
    );
  }

  private async executeUpdateRewardProgramAdmin(
    prepaidCardAddress: string,
    rewardProgramId: string,
    newAdmin: string,
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
      'updateRewardProgramAdmin',
      this.layer2Web3.eth.abi.encodeParameters(['address', 'address'], [rewardProgramId, newAdmin]),
      signatures,
      nonce
    );
  }

  private async executeAddRewardRule(
    prepaidCardAddress: string,
    rewardProgramId: string,
    blob: string,
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
      'addRewardRule',
      this.layer2Web3.eth.abi.encodeParameters(['address', 'bytes'], [rewardProgramId, blob]),
      signatures,
      nonce
    );
  }

  async getRewardProgramInfo(rewardProgramId: string): Promise<RewardProgramInfo> {
    if (!(await this.isRewardProgram(rewardProgramId))) {
      throw new Error('Not an existing reward program');
    }
    const locked = await this.isLocked(rewardProgramId);
    const rewardProgramAdmin = await this.getRewardProgramAdmin(rewardProgramId);
    const blob = await this.getBlob(rewardProgramId);
    const ruleJson = await this.getRuleJson(rewardProgramId);
    const programExplainer = this.getProgramExplainer(ruleJson);

    let rewardPool = await getSDK('RewardPool', this.layer2Web3);
    const tokenBalances = await rewardPool.rewardProgramBalances(rewardProgramId);
    return {
      rewardProgramId,
      rewardProgramAdmin,
      locked,
      blob,
      tokenBalances,
      programExplainer,
    };
  }

  /**
   * The `getRewardProgramsInfo` is a catch-all query that enlist all information about reward programs that have been registered.
   *
   * @example
   * ```ts
   * let rewardManagerAPI = await getSDK('RewardManager', web3);
   * await rewardManagerAPI.getRewardProgramsInfo()
   * ```
   */
  async getRewardProgramsInfo(): Promise<RewardProgramInfo[]> {
    let rewardProgramIds = await this.getRewardPrograms();
    let promises: Promise<RewardProgramInfo>[] = [];
    rewardProgramIds.map((rewardProgramId: string) => {
      promises.push(this.getRewardProgramInfo(rewardProgramId));
    });
    return await Promise.all(promises);
  }

  async getRewardPrograms(): Promise<string[]> {
    let {
      data: { rewardPrograms },
    } = await query(this.layer2Web3, rewardProgramQuery);
    return rewardPrograms.reduce((accum: string[], o: any) => {
      return [...accum, o.id];
    }, []);
  }
  private async getRewardSafeFromTxn(txnHash: string): Promise<any> {
    let rewardMgrAddress = await getAddress('rewardManager', this.layer2Web3);
    let txnReceipt = await waitForTransactionConsistency(this.layer2Web3, txnHash);
    return getParamsFromEvent(this.layer2Web3, txnReceipt, this.rewardeeRegisteredABI(), rewardMgrAddress)[0]
      .rewardSafe;
  }

  async getRewardProgramRegistrationFees(): Promise<number> {
    return Number(await (await this.getRewardManager()).methods.rewardProgramRegistrationFeeInSPEND().call());
  }

  async isRewardProgram(rewardProgramId: string): Promise<boolean> {
    return (await this.getRewardManager()).methods.isRewardProgram(rewardProgramId).call();
  }

  async isValidRewardSafe(rewardSafe: string, rewardProgramId: string): Promise<boolean> {
    return (await this.getRewardManager()).methods.isValidRewardSafe(rewardSafe, rewardProgramId).call();
  }

  async isLocked(rewardProgramId: string): Promise<boolean> {
    return (await this.getRewardManager()).methods.rewardProgramLocked(rewardProgramId).call();
  }
  async newRewardProgramId(): Promise<string> {
    let rewardProgramIdExists: boolean;
    let rewardProgramId: string;
    do {
      rewardProgramId = toChecksumAddress(randomHex(20));
      rewardProgramIdExists = await this.isRewardProgram(rewardProgramId);
    } while (rewardProgramIdExists);
    return rewardProgramId;
  }

  async getRewardSafeOwner(rewardSafeAddress: string): Promise<string> {
    return await (await this.getRewardManager()).methods.getRewardSafeOwner(rewardSafeAddress).call();
  }

  async getRewardProgramAdmin(rewardProgramId: string): Promise<string> {
    return await (await this.getRewardManager()).methods.rewardProgramAdmins(rewardProgramId).call();
  }

  async checkPrepaidCardOwnerIsAdmin(rewardProgramId: string, prepaidCardAddress: string): Promise<void> {
    let prepaidCardAPI = await getSDK('PrepaidCard', this.layer2Web3);
    let prepaidCardMgr = await prepaidCardAPI.getPrepaidCardMgr();
    let prepaidCardOwner = await prepaidCardMgr.methods.getPrepaidCardOwner(prepaidCardAddress).call();
    let rewardProgramAdmin = await this.getRewardProgramAdmin(rewardProgramId);

    if (!(prepaidCardOwner == rewardProgramAdmin)) {
      throw new Error(
        `Owner ${prepaidCardOwner} of prepaid card ${prepaidCardAddress} is not the reward program admin ${rewardProgramAdmin}`
      );
    }
  }

  async getGovernanceAdmin(): Promise<string> {
    return await (await this.getRewardManager()).methods.governanceAdmin().call();
  }
  async getBlob(rewardProgramId: string): Promise<string> {
    return await (await this.getRewardManager()).methods.rule(rewardProgramId).call();
  }
  async getRuleDid(rewardProgramId: string): Promise<string | undefined> {
    const blob = await this.getBlob(rewardProgramId);
    if (blob) {
      return Buffer.from(blob.replace('0x', ''), 'hex').toString('utf-8');
    } else {
      return undefined;
    }
  }

  /**
   * The `getRuleJson` returns the rule structure of a particular reward program. The rule json will include on-chaain "explanation" block which is the lookup map for explanation of each reward. A client can use this map alongside `explanationId` and `explanationData` returned by the reward api.
   * @example
   * ```ts
   * let rewardManagerAPI = await getSDK('RewardManager', web3);
   * await rewardManagerAPI.getRuleJson(rewardProgramId)
   * ```
   */
  async getRuleJson(rewardProgramId: string): Promise<RuleJson> {
    const did = await this.getRuleDid(rewardProgramId);
    if (did) {
      const content = await resolveDoc(did);
      return content;
    } else {
      return { explanation: {}, rules: [] };
    }
  }

  getProgramExplainer(rule: RuleJson, languageTag = 'en') {
    return get(rule, `explanation.${languageTag}.program`, undefined);
  }

  getClaimExplainer(rule: RuleJson, explanationId: string, languageTag = 'en') {
    return get(rule, `explanation.${languageTag}.claim.${explanationId}`, undefined);
  }

  async getRewardSafeDelegateAddress(): Promise<string> {
    return await (await this.getRewardManager()).methods.safeDelegateImplementation().call();
  }

  async getRewardProgram(rewardSafe: string): Promise<string> {
    return await (await this.getRewardManager()).methods.rewardProgramsForRewardSafes(rewardSafe).call();
  }
  async address(): Promise<string> {
    return await getAddress('rewardManager', this.layer2Web3);
  }
  private async getRewardManager(): Promise<Contract> {
    if (this.rewardManager) {
      return this.rewardManager;
    }
    this.rewardManager = new this.layer2Web3.eth.Contract(
      RewardManagerABI as AbiItem[],
      await getAddress('rewardManager', this.layer2Web3)
    );
    return this.rewardManager;
  }
  private async getRewardSafeDelegate(): Promise<Contract> {
    if (this.rewardSafeDelegate) {
      return this.rewardSafeDelegate;
    }
    let rewardSafeDelegateAddress = await this.getRewardSafeDelegateAddress();
    this.rewardSafeDelegate = new this.layer2Web3.eth.Contract(
      RewardSafeDelegateABI as AbiItem[],
      rewardSafeDelegateAddress
    );
    return this.rewardSafeDelegate;
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
