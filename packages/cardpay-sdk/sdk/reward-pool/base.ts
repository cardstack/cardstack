/*global fetch */

import Web3 from 'web3';
import RewardPoolABI from '../../contracts/abi/v0.8.0/reward-pool';
import { Contract, ContractOptions } from 'web3-eth-contract';
import { getAddress } from '../../contracts/addresses';
import { AbiItem, fromWei, toWei } from 'web3-utils';
import { signSafeTx } from '../utils/signing-utils';
import { getSDK } from '../version-resolver';
import { getConstant } from '../constants';
import BN from 'bn.js';
import ERC20ABI from '../../contracts/abi/erc-20';
import ERC677ABI from '../../contracts/abi/erc-677';
import { gasEstimate, executeTransaction, getNextNonceFromEstimate } from '../utils/safe-utils';
import { isTransactionHash, TransactionOptions, waitUntilTransactionMined } from '../utils/general-utils';
import { TransactionReceipt } from 'web3-core';
interface Proof {
  rootHash: string;
  paymentCycle: number;
  tokenAddress: string;
  payee: string;
  proof: string;
  timestamp: string;
  blockNumber: number;
  rewardProgramId: string;
}

const DEFAULT_PAGE_SIZE = 1000000;

export interface RewardTokenBalance {
  tokenAddress: string;
  tokenSymbol: string;
  balance: BN;
}
export default class RewardPool {
  private rewardPool: Contract | undefined;

  constructor(private layer2Web3: Web3) {}

  async getCurrentPaymentCycle(): Promise<string> {
    return await (await this.getRewardPool()).methods.numPaymentCycles().call();
  }

  async getBalanceForProof(
    rewardProgramId: string,
    tokenAddress: string,
    address: string,
    proof: string
  ): Promise<string> {
    return (await this.getRewardPool()).methods
      .balanceForProofWithAddress(rewardProgramId, tokenAddress, address, proof)
      .call();
  }

  async getBalanceForPool(tokenAddress: string): Promise<string> {
    let rewardPoolAddress = await getAddress('rewardPool', this.layer2Web3);
    const tokenContract = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);
    return await tokenContract.methods.balanceOf(rewardPoolAddress).call();
  }

  async rewardTokensAvailable(address: string, rewardProgramId?: string): Promise<string[]> {
    let tallyServiceURL = await getConstant('tallyServiceURL', this.layer2Web3);
    let url =
      `${tallyServiceURL}/reward-tokens/${address}` + (rewardProgramId ? `?reward_program_id=${rewardProgramId}` : '');

    let options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json', //eslint-disable-line @typescript-eslint/naming-convention
      },
    };
    let response = await fetch(url, options);
    if (!response?.ok) {
      throw new Error(await response.text());
    }
    let json = await response.json();
    return json['tokenAddresses'];
  }

  async getProofs(
    address: string,
    tokenAddress?: string,
    rewardProgramId?: string,
    offset?: number,
    limit?: number
  ): Promise<Proof[]> {
    let tallyServiceURL = await getConstant('tallyServiceURL', this.layer2Web3);
    let url =
      `${tallyServiceURL}/merkle-proofs/${address}` +
      (tokenAddress ? `?token_address=${tokenAddress}` : '') +
      (rewardProgramId ? `&reward_program_id=${rewardProgramId}` : '') +
      (offset ? `&offset=${offset}` : '') +
      (limit ? `&limit=${limit}` : `&limit=${DEFAULT_PAGE_SIZE}`);
    let options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json', //eslint-disable-line @typescript-eslint/naming-convention
      },
    };
    let response = await fetch(url, options);
    let json = await response.json();
    let count = json['count'];
    console.log(`Total of ${count} proofs retrieved for payee ${address} for token ${tokenAddress}`);
    if (!response?.ok) {
      throw new Error(await response.text());
    }
    return json['results'];
  }

  async rewardTokenBalance(
    address: string,
    tokenAddress: string,
    rewardProgramId?: string
  ): Promise<RewardTokenBalance> {
    let rewardTokensAvailable = await this.rewardTokensAvailable(address, rewardProgramId);
    if (!rewardTokensAvailable.includes(tokenAddress)) {
      throw new Error(`Payee does not have any reward token ${tokenAddress}`);
    }
    const tokenContract = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);
    let tokenSymbol = await tokenContract.methods.symbol().call();
    let proofs = await this.getProofs(address, tokenAddress, rewardProgramId);

    let rewardPool = await this.getRewardPool();
    let ungroupedTokenBalance = await Promise.all(
      proofs.map(async (o: Proof) => {
        const balance = await rewardPool.methods
          .balanceForProofWithAddress(o.rewardProgramId, o.tokenAddress, address, o.proof)
          .call();
        return {
          tokenAddress: o.tokenAddress,
          tokenSymbol,
          balance: new BN(balance),
        };
      })
    );
    return aggregateBalance(ungroupedTokenBalance);
  }

  async rewardTokenBalances(address: string, rewardProgramId?: string): Promise<RewardTokenBalance[]> {
    let rewardTokensAvailable = await this.rewardTokensAvailable(address, rewardProgramId);
    const ungroupedTokenBalance = await Promise.all(
      rewardTokensAvailable.map(async (tokenAddress: string) => {
        return this.rewardTokenBalance(address, tokenAddress, rewardProgramId);
      })
    );
    return ungroupedTokenBalance;
  }

  async addRewardTokens(txnHash: string): Promise<TransactionReceipt>;
  async addRewardTokens(
    safeAddress: string,
    rewardProgramId: string,
    tokenAddress: string,
    amount: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt>;
  async addRewardTokens(
    safeAddressOrTxnHash: string,
    rewardProgramId?: string,
    tokenAddress?: string,
    amount?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt> {
    if (isTransactionHash(safeAddressOrTxnHash)) {
      let txnHash = safeAddressOrTxnHash;
      return await waitUntilTransactionMined(this.layer2Web3, txnHash);
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
    let balance = new BN(toWei(await token.methods.balanceOf(safeAddress).call()));
    let weiAmount = new BN(toWei(amount));
    if (balance.lt(weiAmount)) {
      throw new Error(
        `Safe does not have enough balance add reward tokens. The reward token ${tokenAddress} balance of the safe ${safeAddress} is ${fromWei(
          balance
        )}, the total amount necessary to add reward tokens is ${fromWei(weiAmount)} ${symbol} + a small amount for gas`
      );
    }
    let payload = await this.getAddRewardTokensPayload(rewardProgramId, tokenAddress, weiAmount);
    let estimate = await gasEstimate(this.layer2Web3, safeAddress, tokenAddress, '0', payload, 0, tokenAddress);
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
      estimate,
      nonce,
      await signSafeTx(this.layer2Web3, safeAddress, tokenAddress, payload, estimate, nonce, from)
    );
    if (typeof onTxnHash === 'function') {
      await onTxnHash(gnosisTxn.ethereumTx.txHash);
    }
    return await waitUntilTransactionMined(this.layer2Web3, gnosisTxn.ethereumTx.txHash);
  }

  async claimRewards(txnHash: string): Promise<TransactionReceipt>;
  async claimRewards(
    safeAddress: string,
    rewardProgramId: string,
    tokenAddress: string,
    proof: string,
    amount: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt>;
  async claimRewards(
    safeAddressOrTxnHash: string,
    rewardProgramId?: string,
    tokenAddress?: string,
    proof?: string,
    amount?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt> {
    if (isTransactionHash(safeAddressOrTxnHash)) {
      let txnHash = safeAddressOrTxnHash;
      return await waitUntilTransactionMined(this.layer2Web3, txnHash);
    }
    let safeAddress = safeAddressOrTxnHash;
    if (!rewardProgramId) {
      throw new Error('rewardProgramId must be provided');
    }
    if (!tokenAddress) {
      throw new Error('tokenAddress must be provided');
    }
    if (!proof) {
      throw new Error('proof must be provided');
    }
    if (!amount) {
      throw new Error('amount must be provided');
    }

    let rewardManager = await getSDK('RewardManager', this.layer2Web3);

    if (!(await rewardManager.isRewardProgram(rewardProgramId))) {
      throw new Error('reward program does not exist');
    }

    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let rewardSafeOwner = await rewardManager.getRewardSafeOwner(safeAddress);
    let unclaimedRewards = new BN(await this.getBalanceForProof(rewardProgramId, tokenAddress, rewardSafeOwner, proof));
    let rewardPoolBalanceForRewardProgram = (await this.balance(rewardProgramId, tokenAddress)).balance;

    if (!(rewardSafeOwner == from)) {
      throw new Error(
        `Reward safe owner is NOT the signer of transaction.
The owner of reward safe ${safeAddress} is ${rewardSafeOwner}, but the signer is ${from}`
      );
    }

    let weiAmount = new BN(toWei(amount));
    if (weiAmount.gt(unclaimedRewards)) {
      throw new Error(
        `Insufficient rewards for rewardSafeOwner.
For the proof, the reward safe owner can only redeem ${unclaimedRewards} but user is asking for ${amount}`
      );
    }

    if (weiAmount.gt(rewardPoolBalanceForRewardProgram)) {
      throw new Error(
        `Insufficient funds inside reward pool for reward program.
The reward program ${rewardProgramId} has balance equals ${fromWei(
          rewardPoolBalanceForRewardProgram.toString()
        )} but user is asking for ${amount}`
      );
    }

    let rewardPoolAddress = await getAddress('rewardPool', this.layer2Web3);

    let payload = (await this.getRewardPool()).methods
      .claim(
        rewardProgramId,
        tokenAddress,
        weiAmount, //maybe in wei
        proof
      )
      .encodeABI();
    let estimate = await gasEstimate(this.layer2Web3, safeAddress, rewardPoolAddress, '0', payload, 0, tokenAddress);

    let gasCost = new BN(estimate.dataGas).add(new BN(estimate.baseGas)).mul(new BN(estimate.gasPrice));
    if (unclaimedRewards.lt(weiAmount.add(gasCost))) {
      throw new Error(
        `Reward safe does not have enough to pay for gas when claiming rewards. The reward safe ${safeAddress} unclaimed balance for token ${tokenAddress} is ${fromWei(
          unclaimedRewards
        )}, amount being claimed is ${amount}, the gas cost is ${fromWei(gasCost)}`
      );
    }
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
      rewardPoolAddress,
      payload,
      estimate,
      nonce,
      await signSafeTx(this.layer2Web3, safeAddress, rewardPoolAddress, payload, estimate, nonce, from)
    );
    if (typeof onTxnHash === 'function') {
      await onTxnHash(gnosisTxn.ethereumTx.txHash);
    }
    return await waitUntilTransactionMined(this.layer2Web3, gnosisTxn.ethereumTx.txHash);
  }

  async balance(rewardProgramId: string, tokenAddress: string): Promise<RewardTokenBalance> {
    let balance: string = await (await this.getRewardPool()).methods
      .rewardBalance(rewardProgramId, tokenAddress)
      .call();
    let tokenContract = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);
    let tokenSymbol = await tokenContract.methods.symbol().call();
    return {
      tokenAddress,
      tokenSymbol,
      balance: new BN(balance),
    };
  }

  async address(): Promise<string> {
    return await getAddress('rewardPool', this.layer2Web3);
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

const aggregateBalance = (arr: RewardTokenBalance[]): RewardTokenBalance => {
  return arr.reduce((accum, { tokenAddress, tokenSymbol, balance }: RewardTokenBalance) => {
    return {
      tokenAddress,
      tokenSymbol,
      balance: accum.balance.add(balance),
    };
  });
};
