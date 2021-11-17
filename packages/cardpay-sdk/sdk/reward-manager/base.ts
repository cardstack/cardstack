import Web3 from 'web3';
import RewardManagerABI from '../../contracts/abi/v0.8.5/reward-manager';
import { Contract, ContractOptions } from 'web3-eth-contract';
import { getAddress } from '../../contracts/addresses';
import { AbiItem, randomHex, toChecksumAddress, fromWei, toWei } from 'web3-utils';
import { isTransactionHash, TransactionOptions, waitForSubgraphIndexWithTxnReceipt } from '../utils/general-utils';
import { getSDK } from '../version-resolver';
import { TransactionReceipt } from 'web3-core';
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
} from '../utils/safe-utils';
import { Signature, signPrepaidCardSendTx } from '../utils/signing-utils';
import BN from 'bn.js';
import ERC20ABI from '../../contracts/abi/erc-20';
import { signRewardSafe, fullSignatureTxAsBytes, createEIP1271VerifyingData } from '../utils/signing-utils';
import { ZERO_ADDRESS } from '../constants';
import GnosisSafeABI from '../../contracts/abi/gnosis-safe';

export default class RewardManager {
  private rewardManager: Contract | undefined;

  constructor(private layer2Web3: Web3) {}

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
        txReceipt: await waitForSubgraphIndexWithTxnReceipt(this.layer2Web3, txnHash),
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
      txReceipt: await waitForSubgraphIndexWithTxnReceipt(this.layer2Web3, txnHash),
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
        txReceipt: await waitForSubgraphIndexWithTxnReceipt(this.layer2Web3, txnHash),
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
      txReceipt: await waitForSubgraphIndexWithTxnReceipt(this.layer2Web3, txnHash),
    };
  }

  async lockRewardProgram(txnHash: string): Promise<TransactionReceipt>;
  async lockRewardProgram(
    prepaidCardAddress: string,
    rewardProgramId: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt>;
  async lockRewardProgram(
    prepaidCardAddressOrTxnHash: string,
    rewardProgramId?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt> {
    if (isTransactionHash(prepaidCardAddressOrTxnHash)) {
      let txnHash = prepaidCardAddressOrTxnHash;
      return await waitForSubgraphIndexWithTxnReceipt(this.layer2Web3, txnHash);
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
    return await waitForSubgraphIndexWithTxnReceipt(this.layer2Web3, txnHash);
  }

  async updateRewardProgramAdmin(txnHash: string): Promise<TransactionReceipt>;
  async updateRewardProgramAdmin(
    prepaidCardAddress: string,
    rewardProgramId: string,
    newAdmin: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt>;
  async updateRewardProgramAdmin(
    prepaidCardAddressOrTxnHash: string,
    rewardProgramId?: string,
    newAdmin?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt> {
    if (isTransactionHash(prepaidCardAddressOrTxnHash)) {
      let txnHash = prepaidCardAddressOrTxnHash;
      return await waitForSubgraphIndexWithTxnReceipt(this.layer2Web3, txnHash);
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
    return await waitForSubgraphIndexWithTxnReceipt(this.layer2Web3, txnHash);
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
  private async getRewardSafeFromTxn(txnHash: string): Promise<any> {
    let rewardMgrAddress = await getAddress('rewardManager', this.layer2Web3);
    let txnReceipt = await waitForSubgraphIndexWithTxnReceipt(this.layer2Web3, txnHash);
    return getParamsFromEvent(this.layer2Web3, txnReceipt, this.rewardeeRegisteredABI(), rewardMgrAddress)[0]
      .rewardSafe;
  }

  async getRewardProgramRegistrationFees(): Promise<number> {
    return Number(await (await this.getRewardManager()).methods.rewardProgramRegistrationFeeInSPEND().call());
  }

  async getRewardeeRegistrationFees(): Promise<number> {
    return Number(await (await this.getRewardManager()).methods.rewardeeRegistrationFeeInSPEND().call());
  }

  async isRewardProgram(rewardProgramId: string): Promise<boolean> {
    return (await this.getRewardManager()).methods.isRewardProgram(rewardProgramId).call();
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

  async withdraw(txnHash: string): Promise<TransactionReceipt>;
  async withdraw(
    safeAddress: string,
    to: string,
    tokenAddress: string,
    amount: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt>;
  async withdraw(
    safeAddressOrTxnHash: string,
    to?: string,
    tokenAddress?: string,
    amount?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt> {
    if (isTransactionHash(safeAddressOrTxnHash)) {
      let txnHash = safeAddressOrTxnHash;
      return await waitForSubgraphIndexWithTxnReceipt(this.layer2Web3, txnHash);
    }
    if (!safeAddressOrTxnHash) {
      throw new Error('safeAddress is required');
    }
    if (!tokenAddress) {
      throw new Error('tokenAddress must be provided');
    }
    if (!amount) {
      throw new Error('amount must be provided');
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

    if (!(rewardSafeOwner == from)) {
      throw new Error(
        `Reward safe owner is NOT the signer of transaction.
The owner of reward safe ${safeAddress} is ${rewardSafeOwner}, but the signer is ${from}`
      );
    }
    let weiAmount = amount ? new BN(toWei(amount)) : safeBalance;
    if (weiAmount.gt(safeBalance)) {
      throw new Error(`Insufficient funds for inside reward safe`);
    }

    let transfer = await token.methods.transfer(rewardSafeOwner, weiAmount);
    let transferPayload = transfer.encodeABI();

    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let transferNonce: BN;
    if (nonce != null) {
      // a passed in nonce represents the next nonce to use, so we add 1 to it
      // to get the nonce we'd want to use for the transfer execTransaction
      transferNonce = nonce.add(new BN(1));
    } else {
      let rewardSafe = new this.layer2Web3.eth.Contract(GnosisSafeABI as AbiItem[], safeAddress);
      let currentNonce = new BN(await rewardSafe.methods.nonce().call());
      transferNonce = currentNonce.add(new BN('1'));
    }
    // to token contract
    let innerEstimate = await gasEstimate(
      this.layer2Web3,
      safeAddress,
      tokenAddress,
      '0',
      transferPayload,
      0,
      tokenAddress
    );
    // innerEstimate = {
    //   ...innerEstimate,
    //   safeTxGas: '0',
    //   baseGas: '0',
    //   dataGas: '0',
    // };

    let fullSignatureInnerExec = await fullSignatureTxAsBytes(
      this.layer2Web3,
      tokenAddress,
      0,
      transferPayload,
      0,
      innerEstimate,
      safeAddress, //or maybe zero address
      transferNonce,
      rewardSafeOwner,
      safeAddress,
      rewardManagerAddress
    );

    let gasCost = new BN(innerEstimate.dataGas).add(new BN(innerEstimate.baseGas)).mul(new BN(innerEstimate.gasPrice));
    if (weiAmount.lt(gasCost)) {
      throw new Error(
        `Reward safe does not have enough to pay for gas when claiming rewards. The reward safe ${safeAddress} balance for token ${tokenAddress} is ${fromWei(
          safeBalance
        )}, amount being claimed is ${amount}, the gas cost is ${fromWei(gasCost)}`
      );
    }
    console.log('tokenAddress', tokenAddress);
    console.log('innerEstimate', innerEstimate);
    let payload = (await this.getRewardManager()).methods
      .withdrawFromRewardSafe(
        tokenAddress,
        weiAmount,
        innerEstimate.safeTxGas,
        innerEstimate.baseGas,
        innerEstimate.gasPrice,
        innerEstimate.gasToken,
        fullSignatureInnerExec
      )
      .encodeABI();

    if (nonce == null) {
      nonce = getNextNonceFromEstimate(innerEstimate);
      if (typeof onNonce === 'function') {
        onNonce(nonce);
      }
    }
    let estimate = {
      ...innerEstimate,
      safeTxGas: '100000000000',
      baseGas: '0',
      dataGas: '0',
    };
    // estimate = await gasEstimate(this.layer2Web3, safeAddress, rewardManagerAddress, '0', payload, 0, tokenAddress);
    // console.log(estimate);
    let rewardSafe = new this.layer2Web3.eth.Contract(GnosisSafeABI as AbiItem[], safeAddress);
    let currentNonce = new BN(await rewardSafe.methods.nonce().call());
    let fullSignature = await signRewardSafe(
      this.layer2Web3,
      rewardManagerAddress,
      0,
      payload,
      0,
      estimate,
      tokenAddress,
      ZERO_ADDRESS,
      currentNonce,
      rewardSafeOwner,
      safeAddress,
      rewardManagerAddress
    );
    console.log('fullSignature', fullSignature);

    let eip1271Data = createEIP1271VerifyingData(
      this.layer2Web3,
      rewardManagerAddress,
      '0',
      payload,
      '0',
      estimate.safeTxGas,
      estimate.baseGas,
      estimate.gasPrice,
      tokenAddress,
      ZERO_ADDRESS,
      currentNonce.toString()
    );
    let gnosisTxn = await executeTransaction(
      this.layer2Web3,
      safeAddress,
      rewardManagerAddress,
      payload,
      estimate,
      currentNonce,
      fullSignature,
      eip1271Data
    );
    if (typeof onTxnHash === 'function') {
      await onTxnHash(gnosisTxn.ethereumTx.txHash);
    }
    return await waitForSubgraphIndexWithTxnReceipt(this.layer2Web3, gnosisTxn.ethereumTx.txHash);
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
