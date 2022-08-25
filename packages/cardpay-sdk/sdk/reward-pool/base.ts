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
import { Signer } from 'ethers';
import { query } from '../utils/graphql';
import { groupBy } from 'lodash';

export interface Proof {
  rootHash: string;
  paymentCycle: number;
  tokenAddress: string;
  payee: string;
  proofArray: string[];
  rewardProgramId: string;
  amount: BN;
  leaf: string;
  isValid: boolean;
}

export interface ClaimableProof extends Proof {
  safeAddress: string;
  gasEstimate: GasEstimate;
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
  amount: BN;
}

export interface FullLeaf extends Partial<TokenTransferDetail>, Leaf {}

const DEFAULT_PAGE_SIZE = 1000000;

export interface RewardTokenBalance {
  rewardProgramId: string;
  tokenAddress: string;
  balance: BN;
}

export interface HasTokenAddress {
  tokenAddress: string;
}
export type WithSymbol<T extends HasTokenAddress> = T & {
  tokenSymbol: string;
};

export default class RewardPool {
  private rewardPool: Contract | undefined;

  constructor(private layer2Web3: Web3, private layer2Signer?: Signer) {}

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

  async getProofs(
    address: string,
    safeAddress: string,
    rewardProgramId?: string,
    tokenAddress?: string,
    knownClaimed?: boolean,
    offset?: number,
    limit?: number
  ): Promise<WithSymbol<ClaimableProof>[]>;
  async getProofs(
    address: string,
    safeAddress: undefined,
    rewardProgramId?: string,
    tokenAddress?: string,
    knownClaimed?: boolean,
    offset?: number,
    limit?: number
  ): Promise<WithSymbol<Proof>[]>;
  async getProofs(
    address: string,
    safeAddress?: string,
    rewardProgramId?: string,
    tokenAddress?: string,
    knownClaimed?: boolean,
    offset?: number,
    limit?: number
  ): Promise<WithSymbol<Proof | ClaimableProof>[]> {
    let tallyServiceURL = await getConstant('tallyServiceURL', this.layer2Web3);
    let url = new URL(`${tallyServiceURL}/merkle-proofs/${address}`);
    if (rewardProgramId) {
      url.searchParams.append('rewardProgramId', rewardProgramId);
    }
    if (tokenAddress) {
      url.searchParams.append('token', tokenAddress);
    }
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
    let rewardTokens = await this.getRewardTokens();
    let res: Proof[] = [];
    let claimedLeafs: string[];
    if (!knownClaimed) {
      claimedLeafs = await this.getClaimedLeafs(address, rewardProgramId);
    }
    json.map((o: any) => {
      if (rewardTokens.includes(o.tokenAddress)) {
        // filters for known reward tokens
        if (!knownClaimed) {
          // proofs not claimed yet
          if (!claimedLeafs.includes(o.leaf)) {
            // filters for proofs has not been claimed
            let { validFrom, validTo }: FullLeaf = this.decodeLeaf(o.leaf) as FullLeaf;
            res.push({
              ...o,
              isValid: validFrom <= currentBlock && validTo > currentBlock,
            });
          }
        } else {
          let { validFrom, validTo }: FullLeaf = this.decodeLeaf(o.leaf) as FullLeaf;
          res.push({
            ...o,
            isValid: validFrom <= currentBlock && validTo > currentBlock,
          });
        }
      }
    });
    const proofs = await this.addTokenSymbol(res);
    if (safeAddress) {
      // if safeAddress is provided, we need to estimate gas of each proof claim
      const proofsWithGasFees = await Promise.all(
        proofs.map(async (proof) => {
          const gasEstimate = await this.claimGasEstimate(safeAddress, proof.leaf, proof.proofArray, false);
          return {
            ...proof,
            gasEstimate,
            safeAddress,
          };
        })
      );
      return proofsWithGasFees;
    } else {
      return proofs;
    }
  }

  claimsQuery(payee: string, rewardProgramId?: string, skip = 0): string {
    if (rewardProgramId) {
      return `
      query {
          rewardeeClaims(
            where:{
              rewardee: "${payee}",
              rewardProgram: "${rewardProgramId}" 
            }, 
            skip: ${skip},
            orderBy: blockNumber, 
            orderDirection: asc
          ){
            leaf
          }
      }
    `;
    } else {
      return `
      query {
          rewardeeClaims(
            where:{
              rewardee: "${payee}"
            },
            skip: ${skip}
            orderBy: blockNumber, 
            orderDirection: asc
          ){
            leaf
          }
      }
    `;
    }
  }

  async getClaimedLeafs(payee: string, rewardProgramId?: string): Promise<string[]> {
    //PLEASE DO NOT CHANGE THIS.
    //Subgraph has a max pagination of 100
    let paginateSize = 100;
    let i = 0;
    let done = false;
    let leafs: string[] = [];
    while (!done) {
      let queryStr = this.claimsQuery(payee, rewardProgramId, i * paginateSize);
      let res = await query(this.layer2Web3, queryStr);
      if (res.data.rewardeeClaims.length != 0) {
        let {
          data: { rewardeeClaims },
        } = res;
        let new_leafs = rewardeeClaims.reduce((accum: string[], o: any) => {
          return [...accum, o.leaf];
        }, []);
        leafs = leafs.concat(new_leafs);
        i++;
      } else {
        done = true;
      }
    }
    return leafs;
  }

  async rewardTokenBalances(address: string, rewardProgramId?: string): Promise<WithSymbol<RewardTokenBalance>[]> {
    const unclaimedValidProofs = (await this.getProofs(address, undefined, rewardProgramId, undefined, false)).filter(
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

  async rewardTokenBalancesWithoutDust(
    address: string,
    safeAddress: string,
    rewardProgramId?: string
  ): Promise<WithSymbol<RewardTokenBalance>[]> {
    const unclaimedValidProofs = (await this.getProofs(address, safeAddress, rewardProgramId, undefined, false))
      .filter((o) => o.isValid)
      .filter((o) => {
        return o.gasEstimate.amount.lt(new BN(o.amount));
      });
    let tokenBalances = unclaimedValidProofs.map((o: ClaimableProof) => {
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
      await signSafeTx(this.layer2Web3, safeAddress, tokenAddress, payload, estimate, nonce, from, this.layer2Signer)
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
    acceptPartialClaim: boolean,
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
    let rewardPoolBalanceForRewardProgram = (await this.rewardProgramBalance(rewardProgramId, token)).balance;
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
      await getAddress('rewardManager', this.layer2Web3),
      this.layer2Signer
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

  async claimAll(
    safeAddress: string,
    tokenAddress?: string,
    rewardProgramId?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt[]> {
    let rewardManager = await getSDK('RewardManager', this.layer2Web3);
    let rewardSafeOwner = await rewardManager.getRewardSafeOwner(safeAddress);
    const unclaimedValidProofs = (
      await this.getProofs(rewardSafeOwner, safeAddress, rewardProgramId, tokenAddress, false)
    ).filter((o) => o.isValid);
    const unclaimedValidProofsWithoutCryptoDust = unclaimedValidProofs.filter((o) => {
      return o.gasEstimate.amount.lt(new BN(o.amount));
    });
    console.log(`Claiming ${unclaimedValidProofsWithoutCryptoDust} out of ${unclaimedValidProofs} proofs`);
    return this.claimAllProofs(unclaimedValidProofsWithoutCryptoDust, safeAddress, txnOptions, contractOptions);
  }

  async claimAllProofs(
    unclaimedValidProofs: WithSymbol<Proof>[],
    safeAddress: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<SuccessfulTransactionReceipt[]> {
    const proofs = unclaimedValidProofs.filter((o) => o.isValid);
    const receipts: SuccessfulTransactionReceipt[] = [];
    for (const { leaf, proofArray } of proofs) {
      const receipt = await this.claim(safeAddress, leaf, proofArray, false, txnOptions, contractOptions);
      receipts.push(receipt);
    }
    return receipts;
  }

  async sufficientBalanceInPool(
    rewardProgramId: string,
    amount: BN,
    token: string,
    acceptPartialClaim?: boolean
  ): Promise<any> {
    let weiAmount = new BN(amount);
    let rewardPoolBalanceForRewardProgram = (await this.rewardProgramBalance(rewardProgramId, token)).balance;
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

  async claimAllGasEstimate(
    rewardSafeAddress: string,
    rewardProgramId?: string,
    tokenAddress?: string
  ): Promise<GasEstimate[]> {
    let rewardManager = await getSDK('RewardManager', this.layer2Web3);
    let rewardSafeOwner = await rewardManager.getRewardSafeOwner(rewardSafeAddress);
    const proofs = await this.getProofs(rewardSafeOwner, rewardSafeAddress, rewardProgramId, tokenAddress, false);

    const unclaimedValidProofsWithSingleToken = proofs
      .filter((o) => o.isValid)
      .filter((o) => {
        return o.gasEstimate.amount.lt(new BN(o.amount));
      });
    return aggregateGas(unclaimedValidProofsWithSingleToken);
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
    let rewardPoolBalanceForRewardProgram = (await this.rewardProgramBalance(rewardProgramId, tokenAddress)).balance;

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
      await signSafeTx(
        this.layer2Web3,
        safeAddress,
        rewardPoolAddress,
        payload,
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
    return await waitForTransactionConsistency(this.layer2Web3, txnHash, safeAddress, nonce);
  }

  async rewardProgramBalances(rewardProgramId: string): Promise<WithSymbol<RewardTokenBalance>[]> {
    const tokensAvailable = await this.getRewardTokens();
    let promises = tokensAvailable.map((tokenAddress) => {
      return this.rewardProgramBalance(rewardProgramId, tokenAddress);
    });
    let rewardTokenBalance = await Promise.all(promises);
    return this.addTokenSymbol(rewardTokenBalance);
  }

  async rewardProgramBalance(rewardProgramId: string, tokenAddress: string): Promise<RewardTokenBalance> {
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

  async addTokenSymbol<T extends HasTokenAddress>(arrWithTokenAddress: T[]): Promise<WithSymbol<T>[]> {
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
    let rewardTokens = await this.getRewardTokens();
    let entries = await Promise.all(
      tokenAddresses.map(async (tokenAddress) => {
        if (!rewardTokens.includes(tokenAddress)) {
          throw new Error(`Reward token ${tokenAddress} not recognized by sdk`);
        }
        return [tokenAddress, (await assets.getTokenInfo(tokenAddress)).symbol];
      })
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

  isClaimableProof(proof: WithSymbol<Proof> | WithSymbol<ClaimableProof>): proof is WithSymbol<ClaimableProof> {
    if ((proof as WithSymbol<ClaimableProof>).gasEstimate) {
      return true;
    } else {
      return false;
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
  private async getRewardTokens(): Promise<string[]> {
    let cardTokenAddress = await getAddress('cardCpxd', this.layer2Web3);
    return [cardTokenAddress];
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

const aggregateGas = (arr: ClaimableProof[]): GasEstimate[] => {
  let o = groupBy(arr, (o: ClaimableProof) => o.tokenAddress);
  return Object.entries(o).map(([gasToken, proofs]) => {
    let amount = proofs.reduce((accum, proof) => {
      return accum.add(new BN(proof.gasEstimate.amount));
    }, new BN(0));
    return { gasToken, amount };
  });
};
