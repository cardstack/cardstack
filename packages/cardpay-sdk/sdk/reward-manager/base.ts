import Web3 from 'web3';
import RewardSafeDelegateABI from '../../contracts/abi/v0.9.0/reward-safe-delegate-implementation';
import PrepaidCardManagerABI from '../../contracts/abi/v0.9.0/prepaid-card-manager';
import RewardManagerABI from '../../contracts/abi/v0.9.0/reward-manager';
import { Contract, ContractOptions } from 'web3-eth-contract';
import { getAddress } from '../../contracts/addresses';
import { AbiItem, randomHex, toChecksumAddress, fromWei } from 'web3-utils';
import { isTransactionHash, TransactionOptions, waitForTransactionConsistency } from '../utils/general-utils';
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
} from '../utils/safe-utils';
import { Signature, signPrepaidCardSendTx } from '../utils/signing-utils';
import BN from 'bn.js';
import ERC20ABI from '../../contracts/abi/erc-20';
import { signRewardSafe, createEIP1271VerifyingData } from '../utils/signing-utils';
import { ZERO_ADDRESS } from '../constants';
import { WithSymbol, RewardTokenBalance } from '@cardstack/cardpay-sdk';
import { query } from '../utils/graphql';

export interface RewardProgramInfo {
  rewardProgramId: string;
  rewardProgramAdmin: string;
  locked: boolean;
  rule: string;
  tokenBalances: WithSymbol<RewardTokenBalance>[];
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

export default class RewardManager {
  private rewardManager: Contract | undefined;
  private rewardSafeDelegate: Contract | undefined;

  constructor(private layer2Web3: Web3) {}

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
      txReceipt: await waitForTransactionConsistency(this.layer2Web3, txnHash, prepaidCardAddress, nonce!),
    };
  }

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
      txReceipt: await waitForTransactionConsistency(this.layer2Web3, txnHash, prepaidCardAddress, nonce!),
    };
  }

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
        await signPrepaidCardSendTx(this.layer2Web3, prepaidCardAddress, payload, nonce, from),
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
        await signPrepaidCardSendTx(this.layer2Web3, prepaidCardAddress, payload, nonce, from),
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
        await signPrepaidCardSendTx(this.layer2Web3, prepaidCardAddress, payload, nonce, from),
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
    let rewardSafeDelegate = await this.getRewardSafeDelegate();
    if (!(rewardSafeOwner == from)) {
      throw new Error(
        `Reward safe owner is NOT the signer of transaction.
The owner of reward safe ${safeAddress} is ${rewardSafeOwner}, but the signer is ${from}`
      );
    }

    let estimate;
    let withdrawPayload;
    let weiAmount;
    if (amount) {
      //when amount is given, we assume that amount is string in wei that has already had gasCost deducted from it
      let weiAmount = new BN(amount);
      if (weiAmount.gt(safeBalance)) {
        throw new Error(
          `Insufficient funds inside reward safe. safeBalance = ${fromWei(safeBalance)} and amount = ${fromWei(amount)}`
        );
      }
      let withdraw = await rewardSafeDelegate.methods.withdraw(rewardManagerAddress, tokenAddress, to, weiAmount);
      withdrawPayload = withdraw.encodeABI();
      estimate = await gasEstimate(
        this.layer2Web3,
        safeAddress,
        rewardSafeDelegateAddress,
        '0',
        withdrawPayload,
        Operation.DELEGATECALL,
        tokenAddress
      );
      let gasCost = new BN(estimate.safeTxGas).add(new BN(estimate.baseGas)).mul(new BN(estimate.gasPrice));
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
      weiAmount = safeBalance;
      let withdraw = await rewardSafeDelegate.methods.withdraw(rewardManagerAddress, tokenAddress, to, weiAmount);
      withdrawPayload = withdraw.encodeABI();
      // The preEstimate is used to estimate the gasCost mainly to check that the safeBalance has sufficient leftover to pay for gas after withdrawing a specified amount
      // This is preEstimate is typically used when withdrawing full balances from a safe
      // It is recommeended that for any preEstimate that we avoid using it
      let preEstimate = await gasEstimate(
        this.layer2Web3,
        safeAddress,
        rewardSafeDelegateAddress,
        '0',
        withdrawPayload,
        Operation.DELEGATECALL,
        tokenAddress
      );
      let gasCost = new BN(preEstimate.safeTxGas).add(new BN(preEstimate.baseGas)).mul(new BN(preEstimate.gasPrice));
      if (weiAmount.lt(gasCost)) {
        throw new Error(
          `Reward safe does not have enough to pay for gas when withdrawing rewards. The reward safe ${safeAddress} balance for token ${tokenAddress} is ${fromWei(
            safeBalance
          )}, the gas cost is ${fromWei(gasCost)}`
        );
      }
      weiAmount = weiAmount.sub(gasCost);
      withdraw = await rewardSafeDelegate.methods.withdraw(rewardManagerAddress, tokenAddress, to, weiAmount);
      withdrawPayload = withdraw.encodeABI();
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
      rewardManagerAddress
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
      eip1271Data
    );
    if (typeof onTxnHash === 'function') {
      await onTxnHash(gnosisTxn.ethereumTx.txHash);
    }
    return await waitForTransactionConsistency(this.layer2Web3, gnosisTxn.ethereumTx.txHash, safeAddress, nonce);
  }

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
      rewardManagerAddress
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
      eip1271Data
    );
    if (typeof onTxnHash === 'function') {
      await onTxnHash(gnosisTxn.ethereumTx.txHash);
    }
    return await waitForTransactionConsistency(this.layer2Web3, gnosisTxn.ethereumTx.txHash, safeAddress, nonce);
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
    const rule = await this.getRewardRule(rewardProgramId);

    let rewardPool = await getSDK('RewardPool', this.layer2Web3);
    const tokenBalances = await rewardPool.balances(rewardProgramId);
    return {
      rewardProgramId,
      rewardProgramAdmin,
      locked,
      rule,
      tokenBalances,
    };
  }

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
  async getRewardRule(rewardProgramId: string): Promise<string> {
    return await (await this.getRewardManager()).methods.rule(rewardProgramId).call();
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
