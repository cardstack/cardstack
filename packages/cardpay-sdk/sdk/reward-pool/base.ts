/*global fetch */

import Web3 from 'web3';
import RewardPoolABI from '../../contracts/abi/v0.9.0/reward-pool';
import { Contract, ContractOptions } from 'web3-eth-contract';
import { getAddress } from '../../contracts/addresses';
import { AbiItem, fromWei, toWei } from 'web3-utils';
import { signRewardSafe, signSafeTx, createEIP1271VerifyingData } from '../utils/signing-utils';
import { getSDK } from '../version-resolver';
import { getConstant, ZERO_ADDRESS } from '../constants';
import BN from 'bn.js';
import ERC20ABI from '../../contracts/abi/erc-20';
import ERC677ABI from '../../contracts/abi/erc-677';
import {
  gasEstimate,
  executeTransaction,
  getNextNonceFromEstimate,
  Operation,
  gasInToken,
  GasEstimate,
} from '../utils/safe-utils';
import { isTransactionHash, TransactionOptions, waitForTransactionConsistency } from '../utils/general-utils';
import type { SuccessfulTransactionReceipt } from '../utils/successful-transaction-receipt';
import GnosisSafeABI from '../../contracts/abi/gnosis-safe';

export interface Proof {
  rootHash: string;
  paymentCycle: number;
  tokenAddress: string;
  payee: string;
  proofArray: string[];
  timestamp: string;
  blockNumber: number;
  rewardProgramId: string;
  amount: BN;
  leaf: string;
  isValid: boolean;
}

export interface Leaf {
  rewardProgramId: string;
  paymentCycleNumber: number;
  validFrom: number;
  validTo: number;
  tokenType: number;
  payee: string;
  transferData: string;
}

export interface TokenTransferDetail {
  token: string;
  amount: string;
}

export interface FullLeaf extends Partial<TokenTransferDetail>, Leaf {}

const DEFAULT_PAGE_SIZE = 1000000;

export interface RewardTokenBalance {
  rewardProgramId?: string;
  tokenAddress: string;
  balance: BN;
}

export type WithSymbol<T extends Proof | RewardTokenBalance> = T & {
  tokenSymbol: string;
};

export default class RewardPool {
  private rewardPool: Contract | undefined;

  constructor(private layer2Web3: Web3) {}

  async getBalance(address: string, tokenAddress: string, rewardProgramId?: string): Promise<BN> {
    const unclaimedValidProofs = (await this.getProofs(address, rewardProgramId, tokenAddress, false)).filter(
      (o) => o.isValid
    );
    return unclaimedValidProofs.reduce((total, { amount }) => {
      return total.add(amount);
    }, new BN('0'));
  }

  async isClaimed(leaf: string): Promise<boolean> {
    return (await this.getRewardPool()).methods.claimed(leaf).call();
  }

  async isValid(leaf: string, proofArray: string[]): Promise<boolean> {
    return (await this.getRewardPool()).methods.valid(leaf, proofArray).call();
  }
  // TOTAL balance of reward pool -- cumulative across reward program
  async getBalanceForPool(tokenAddress: string): Promise<string> {
    let rewardPoolAddress = await getAddress('rewardPool', this.layer2Web3);
    const tokenContract = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);
    return await tokenContract.methods.balanceOf(rewardPoolAddress).call();
  }

  async rewardTokensAvailable(rewardProgramId?: string, address?: string): Promise<string[]> {
    let tallyServiceURL = await getConstant('tallyServiceURL', this.layer2Web3);
    let url = new URL(`${tallyServiceURL}/reward-tokens/`);
    if (rewardProgramId) {
      url.searchParams.append('reward_program_id', rewardProgramId);
    }
    if (address) {
      url.searchParams.append('payee', address);
    }
    let options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };
    let response = await fetch(url.toString(), options);
    if (!response?.ok) {
      throw new Error(await response.text());
    }
    let json = await response.json();
    return json['tokenAddresses'];
  }

  async getProofs(
    address: string,
    rewardProgramId?: string,
    tokenAddress?: string,
    knownClaimed?: boolean,
    offset?: number,
    limit?: number
  ): Promise<WithSymbol<Proof>[]> {
    let tallyServiceURL = await getConstant('tallyServiceURL', this.layer2Web3);
    let url = new URL(`${tallyServiceURL}/merkle-proofs/${address}`);
    if (rewardProgramId) {
      url.searchParams.append('reward_program_id', rewardProgramId);
    }
    if (tokenAddress) {
      url.searchParams.append('token_address', tokenAddress);
    }
    let knownClaimedStr = knownClaimed ? knownClaimed.toString() : 'false';
    url.searchParams.append('known_claimed', knownClaimedStr);
    if (offset) {
      url.searchParams.append('offset', offset.toString());
    }
    url.searchParams.append('limit', limit ? limit.toString() : DEFAULT_PAGE_SIZE.toString());
    let options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };
    let response = await fetch(url.toString(), options);
    let json = await response.json();
    if (!response?.ok) {
      throw new Error(await response.text());
    }
    let currentBlock = await this.layer2Web3.eth.getBlockNumber();
    return this.addTokenSymbol(
      json['results'].map((o: any) => {
        let { validFrom, validTo, tokenType, amount }: FullLeaf = this.decodeLeaf(o.leaf) as FullLeaf;
        if (amount && tokenType == 1) {
          return {
            ...o,
            isValid: validFrom <= currentBlock && validTo > currentBlock,
            amount: new BN(amount),
          };
        } else {
          throw new Error('Cannot decode amount from leaf');
        }
      })
    );
  }

  async rewardTokenBalance(
    address: string,
    tokenAddress: string,
    rewardProgramId?: string
  ): Promise<RewardTokenBalance> {
    let balance = await this.getBalance(address, tokenAddress, rewardProgramId);
    return {
      rewardProgramId,
      tokenAddress,
      balance,
    };
  }

  async rewardTokenBalances(address: string, rewardProgramId?: string): Promise<WithSymbol<RewardTokenBalance>[]> {
    const unclaimedValidProofs = (await this.getProofs(address, rewardProgramId, undefined, false)).filter(
      (o) => o.isValid
    );
    let tokenBalances = unclaimedValidProofs.map((o: Proof) => {
      return {
        tokenAddress: o.tokenAddress,
        rewardProgramId: o.rewardProgramId,
        balance: new BN(o.amount),
      };
    });
    return this.addTokenSymbol(aggregateBalance(tokenBalances));
  }

  async addRewardTokens(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async addRewardTokens(
    safeAddress: string,
    rewardProgramId: string,
    tokenAddress: string,
    amount: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async addRewardTokens(
    safeAddressOrTxnHash: string,
    rewardProgramId?: string,
    tokenAddress?: string,
    amount?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt> {
    if (isTransactionHash(safeAddressOrTxnHash)) {
      let txnHash = safeAddressOrTxnHash;
      return await waitForTransactionConsistency(this.layer2Web3, txnHash);
    }
    let safeAddress = safeAddressOrTxnHash;
    if (!rewardProgramId) {
      throw new Error('rewardProgramId must be provided');
    }
    if (!tokenAddress) {
      throw new Error('tokenAddress must be provided');
    }
    if (!amount) {
      throw new Error('amount must be provided');
    }

    let rewardManager = await getSDK('RewardManager', this.layer2Web3);

    if (!(await rewardManager.isRewardProgram(rewardProgramId))) {
      throw new Error('reward program does not exist');
    }

    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let token = new this.layer2Web3.eth.Contract(ERC677ABI as AbiItem[], tokenAddress);
    let symbol = await token.methods.symbol().call();
    let balance = new BN(await token.methods.balanceOf(safeAddress).call());
    let weiAmount = new BN(toWei(amount));
    if (balance.lt(weiAmount)) {
      throw new Error(
        `Safe does not have enough balance add reward tokens. The reward token ${tokenAddress} balance of the safe ${safeAddress} is ${fromWei(
          balance
        )}, the total amount necessary to add reward tokens is ${fromWei(weiAmount)} ${symbol} + a small amount for gas`
      );
    }
    let payload = await this.getAddRewardTokensPayload(rewardProgramId, tokenAddress, weiAmount);
    let estimate = await gasEstimate(
      this.layer2Web3,
      safeAddress,
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
      safeAddress,
      tokenAddress,
      payload,
      Operation.CALL,
      estimate,
      nonce,
      await signSafeTx(this.layer2Web3, safeAddress, tokenAddress, payload, estimate, nonce, from)
    );
    if (typeof onTxnHash === 'function') {
      await onTxnHash(gnosisTxn.ethereumTx.txHash);
    }
    return await waitForTransactionConsistency(this.layer2Web3, gnosisTxn.ethereumTx.txHash, safeAddress, nonce);
  }

  async claim(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async claim(
    safeAddress: string,
    leaf: string,
    proofArray: string[],
    acceptPartialClaim?: boolean,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async claim(
    safeAddressOrTxnHash: string,
    leaf?: string,
    proofArray?: string[],
    acceptPartialClaim?: boolean,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt> {
    if (isTransactionHash(safeAddressOrTxnHash)) {
      let txnHash = safeAddressOrTxnHash;
      return await waitForTransactionConsistency(this.layer2Web3, txnHash);
    }
    let safeAddress = safeAddressOrTxnHash;
    if (!proofArray) {
      //proofArray can be empty e.g reward only for single rewardee
      throw new Error('proof must be provided');
    }
    if (!leaf) {
      throw new Error('leaf must be provided');
    }

    let { rewardProgramId, payee, token, amount }: FullLeaf = this.decodeLeaf(leaf) as FullLeaf;

    if (!rewardProgramId) {
      throw new Error('rewardProgramId must be provided');
    }
    if (!token) {
      throw new Error('token must be provided');
    }
    if (!amount) {
      throw new Error('amount must be provided');
    }

    let rewardManager = await getSDK('RewardManager', this.layer2Web3);

    if (!(await rewardManager.isRewardProgram(rewardProgramId))) {
      throw new Error('reward program does not exist');
    }
    if (!(await rewardManager.isValidRewardSafe(safeAddress, rewardProgramId))) {
      throw new Error('reward safe is not valid');
    }
    let rewardSafeOwner = await rewardManager.getRewardSafeOwner(safeAddress);

    if (rewardSafeOwner != payee) {
      throw new Error('payee is not owner of the reward safe');
    }

    if (!(await this.isValid(leaf, proofArray))) {
      throw new Error('proof is not valid');
    }
    if (await this.isClaimed(leaf)) {
      throw new Error('reward has been claimed');
    }
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let weiAmount = new BN(amount);
    let rewardPoolBalanceForRewardProgram = (await this.balance(rewardProgramId, token)).balance;
    if (weiAmount.gt(rewardPoolBalanceForRewardProgram)) {
      if (acceptPartialClaim) {
        // acceptPartialClaim means: if reward pool balance is less than amount,
        // rewardee is willing sacrifice full reward and accept the entire reward pool balance
        weiAmount = rewardPoolBalanceForRewardProgram;
      } else {
        throw new Error(
          `Insufficient funds inside reward pool for reward program.
The reward program ${rewardProgramId} has balance equals ${fromWei(
            rewardPoolBalanceForRewardProgram.toString()
          )} but user is asking for ${amount}`
        );
      }
    }

    if (!(rewardSafeOwner == from)) {
      throw new Error(
        `Reward safe owner is NOT the signer of transaction.
    The owner of reward safe ${safeAddress} is ${rewardSafeOwner}, but the signer is ${from}`
      );
    }
    let rewardPoolAddress = await getAddress('rewardPool', this.layer2Web3);

    let payload = (await this.getRewardPool()).methods.claim(leaf, proofArray, acceptPartialClaim).encodeABI();
    let estimate = await gasEstimate(
      this.layer2Web3,
      safeAddress,
      rewardPoolAddress,
      '0',
      payload,
      Operation.CALL,
      token
    );

    let gasCost = new BN(estimate.safeTxGas).add(new BN(estimate.baseGas)).mul(new BN(estimate.gasPrice));
    if (weiAmount.lt(gasCost)) {
      throw new Error(
        `Rewards claimed does not have enough to cover the gas cost. The amount to be claimed is ${fromWei(
          weiAmount
        )}, the gas cost is ${fromWei(gasCost)}`
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
      rewardPoolAddress,
      0,
      payload,
      Operation.CALL,
      estimate,
      token,
      ZERO_ADDRESS,
      nonce,
      rewardSafeOwner,
      safeAddress,
      await getAddress('rewardManager', this.layer2Web3)
    );

    let eip1271Data = createEIP1271VerifyingData(
      this.layer2Web3,
      rewardPoolAddress,
      '0',
      payload,
      Operation.CALL.toString(),
      estimate.safeTxGas,
      estimate.baseGas,
      estimate.gasPrice,
      token,
      ZERO_ADDRESS,
      nonce.toString()
    );
    let gnosisTxn = await executeTransaction(
      this.layer2Web3,
      safeAddress,
      rewardPoolAddress,
      payload,
      Operation.CALL,
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

  async sufficientBalanceInPool(
    rewardProgramId: string,
    amount: string,
    token: string,
    acceptPartialClaim?: boolean
  ): Promise<any> {
    let weiAmount = new BN(amount);
    let rewardPoolBalanceForRewardProgram = (await this.balance(rewardProgramId, token)).balance;
    if (weiAmount.gt(rewardPoolBalanceForRewardProgram)) {
      if (acceptPartialClaim) {
        // acceptPartialClaim means: if reward pool balance is less than amount,
        // rewardee is willing sacrifice full reward and accept the entire reward pool balance
        weiAmount = rewardPoolBalanceForRewardProgram;
        return true;
      } else {
        return false;
      }
    }
    return true;
  }

  async claimGasEstimate(
    rewardSafeAddress: string,
    leaf: string,
    proofArray: string[],
    acceptPartialClaim?: boolean
  ): Promise<GasEstimate> {
    let payload = (await this.getRewardPool()).methods.claim(leaf, proofArray, acceptPartialClaim).encodeABI();
    let o: FullLeaf = this.decodeLeaf(leaf) as FullLeaf;
    if (!o.token) {
      throw new Error('token must be provided');
    }
    let rewardPoolAddress = await getAddress('rewardPool', this.layer2Web3);
    let estimate = await gasEstimate(
      this.layer2Web3,
      rewardSafeAddress,
      rewardPoolAddress,
      '0',
      payload,
      Operation.CALL,
      o.token
    );
    return {
      gasToken: estimate.gasToken,
      amount: gasInToken(estimate),
    };
  }

  async recoverTokens(txnHash: string): Promise<SuccessfulTransactionReceipt>;
  async recoverTokens(
    safeAddress: string,
    rewardProgramId: string,
    tokenAddress: string,
    amount?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt>;
  async recoverTokens(
    safeAddressOrTxnHash: string,
    rewardProgramId?: string,
    tokenAddress?: string,
    amount?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt> {
    if (isTransactionHash(safeAddressOrTxnHash)) {
      let txnHash = safeAddressOrTxnHash;
      return waitForTransactionConsistency(this.layer2Web3, txnHash);
    }
    let safeAddress = safeAddressOrTxnHash;

    if (!rewardProgramId) {
      throw new Error('rewardProgramId is required');
    }
    if (!tokenAddress) {
      throw new Error('tokenAddress is required');
    }
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];

    let rewardPoolAddress = await getAddress('rewardPool', this.layer2Web3);
    let rewardPoolBalanceForRewardProgram = (await this.balance(rewardProgramId, tokenAddress)).balance;

    let rewardManager = await getSDK('RewardManager', this.layer2Web3);

    if (!(await rewardManager.isRewardProgram(rewardProgramId))) {
      throw new Error('reward program does not exist');
    }

    if (!((await rewardManager.getRewardProgramAdmin(rewardProgramId)) == from)) {
      throw new Error('signer is not reward program admin');
    }

    let safe = new this.layer2Web3.eth.Contract(GnosisSafeABI as AbiItem[], safeAddress);
    const safeOwner = (await safe.methods.getOwners().call())[0];

    if (!(safeOwner == from)) {
      throw new Error('signer is not safe owner');
    }
    let weiAmount = amount ? new BN(toWei(amount)) : rewardPoolBalanceForRewardProgram;

    if (rewardPoolBalanceForRewardProgram.lt(weiAmount)) {
      throw new Error(
        `Insufficient funds inside reward pool for reward program. The amount to be claimed is ${amount},
but the balance is the reward pool is ${fromWei(rewardPoolBalanceForRewardProgram).toString()}`
      );
    }
    let payload = (await this.getRewardPool()).methods
      .recoverTokens(rewardProgramId, tokenAddress, weiAmount)
      .encodeABI();
    let estimate = await gasEstimate(
      this.layer2Web3,
      safeAddress,
      rewardPoolAddress,
      '0',
      payload,
      Operation.CALL,
      tokenAddress
    );
    let gasCost = new BN(estimate.safeTxGas).add(new BN(estimate.baseGas)).mul(new BN(estimate.gasPrice));
    if (weiAmount.lt(gasCost)) {
      throw new Error(
        `Funds recovered does not have enough to cover the gas cost. The amount to be recovered is ${amount}, the gas cost is ${fromWei(
          gasCost
        )}`
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
      safeAddress,
      rewardPoolAddress,
      payload,
      Operation.CALL,
      estimate,
      nonce,
      await signSafeTx(this.layer2Web3, safeAddress, rewardPoolAddress, payload, estimate, nonce, from)
    );

    let txnHash = gnosisResult.ethereumTx.txHash;
    if (typeof onTxnHash === 'function') {
      await onTxnHash(txnHash);
    }
    return await waitForTransactionConsistency(this.layer2Web3, txnHash, safeAddress, nonce);
  }

  async balances(rewardProgramId: string): Promise<WithSymbol<RewardTokenBalance>[]> {
    const tokensAvailable = await this.get_reward_tokens();
    let promises = tokensAvailable.map((tokenAddress) => {
      return this.balance(rewardProgramId, tokenAddress);
    });
    let rewardTokenBalance = await Promise.all(promises);
    return this.addTokenSymbol(rewardTokenBalance);
  }

  async balance(rewardProgramId: string, tokenAddress: string): Promise<RewardTokenBalance> {
    let balance: string = await (await this.getRewardPool()).methods
      .rewardBalance(rewardProgramId, tokenAddress)
      .call();
    return {
      rewardProgramId,
      tokenAddress,
      balance: new BN(balance),
    };
  }

  async address(): Promise<string> {
    return await getAddress('rewardPool', this.layer2Web3);
  }

  async get_reward_tokens(): Promise<string[]> {
    let card_token_address = await getAddress('cardCpxd', this.layer2Web3);
    return [card_token_address];
  }

  async addTokenSymbol<T extends Proof | RewardTokenBalance>(arrWithTokenAddress: T[]): Promise<WithSymbol<T>[]> {
    const tokenAddresses = [...new Set(arrWithTokenAddress.map((item) => item.tokenAddress))];
    const tokenMapping = await this.tokenSymbolMapping(tokenAddresses);
    return arrWithTokenAddress.map((o) => {
      return {
        ...o,
        tokenSymbol: tokenMapping[o.tokenAddress],
      };
    });
  }

  async tokenSymbolMapping(tokenAddresses: string[]): Promise<any> {
    let assets = await getSDK('Assets', this.layer2Web3);
    let entries = await Promise.all(
      tokenAddresses.map(async (tokenAddress) => [tokenAddress, (await assets.getTokenInfo(tokenAddress)).symbol])
    );
    return Object.fromEntries(entries);
  }

  decodeLeaf(leaf: string): FullLeaf {
    let outerObj = this.layer2Web3.eth.abi.decodeParameters(
      [
        { type: 'address', name: 'rewardProgramId' },
        { type: 'uint256', name: 'paymentCycleNumber' },
        { type: 'uint256', name: 'validFrom' },
        { type: 'uint256', name: 'validTo' },
        { type: 'uint256', name: 'tokenType' },
        { type: 'address', name: 'payee' },
        { type: 'bytes', name: 'transferData' },
      ],
      leaf
    ) as Leaf;
    let transferDataObj = this.decodeTransferData(outerObj.tokenType, outerObj.transferData);
    if (this.hasTokenTransferDetail(transferDataObj)) {
      return { ...outerObj, ...transferDataObj };
    } else {
      return outerObj;
    }
  }

  private hasTokenTransferDetail(o: any): o is TokenTransferDetail {
    return 'token' in o && 'amount' in o;
  }

  private decodeTransferData(tokenType: number, transferData: string): TokenTransferDetail | string {
    if (tokenType == 0) {
      // Default data
      return transferData;
    } else if (
      // ERC677 / ERC20
      tokenType == 1 ||
      // ERC721 (NFT)
      tokenType == 2
    ) {
      return this.layer2Web3.eth.abi.decodeParameters(
        [
          { type: 'address', name: 'token' },
          { type: 'uint256', name: 'amount' },
        ],
        transferData
      ) as TokenTransferDetail;
    } else {
      throw new Error('Unknown tokenType');
    }
  }

  private async getAddRewardTokensPayload(rewardProgramId: string, tokenAddress: string, amount: BN): Promise<string> {
    let token = new this.layer2Web3.eth.Contract(ERC677ABI as AbiItem[], tokenAddress);
    let rewardPoolAddress = await getAddress('rewardPool', this.layer2Web3);
    let data = this.layer2Web3.eth.abi.encodeParameters(['address'], [rewardProgramId]);
    return token.methods.transferAndCall(rewardPoolAddress, amount, data).encodeABI();
  }

  private async getRewardPool(): Promise<Contract> {
    if (this.rewardPool) {
      return this.rewardPool;
    }
    this.rewardPool = new this.layer2Web3.eth.Contract(
      RewardPoolABI as AbiItem[],
      await getAddress('rewardPool', this.layer2Web3)
    );
    return this.rewardPool;
  }
}

const aggregateBalance = (arr: RewardTokenBalance[]): RewardTokenBalance[] => {
  let output: RewardTokenBalance[] = [];
  arr.forEach(function (item) {
    let existing = output.filter(function (v) {
      return v.rewardProgramId == item.rewardProgramId && v.tokenAddress == item.tokenAddress;
    });
    if (existing.length) {
      var existingIndex = output.indexOf(existing[0]);
      output[existingIndex].balance = output[existingIndex].balance.add(item.balance);
    } else {
      output.push(item);
    }
  });
  return output;
};
