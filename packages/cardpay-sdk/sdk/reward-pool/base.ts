/*global fetch */

import Web3 from 'web3';
import RewardPoolABI from '../../contracts/abi/v0.8.0/reward-pool';
import { Contract } from 'web3-eth-contract';
import { getAddress } from '../../contracts/addresses';
import { AbiItem } from 'web3-utils';
import { getConstant } from '../constants';
import BN from 'bn.js';
import ERC20ABI from '../../contracts/abi/erc-20';
interface Proof {
  rootHash: string;
  paymentCycle: number;
  tokenAddress: string;
  payee: string;
  proof: string;
  timestamp: string;
  blockNumber: number;
}

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

  async getBalanceForProof(tokenAddress: string, address: string, proof: string): Promise<string> {
    return (await this.getRewardPool()).methods.balanceForProofWithAddress(tokenAddress, address, proof).call();
  }

  //tally
  async rewardTokensAvailable(address: string): Promise<string[]> {
    let tallyServiceURL = await getConstant('tallyServiceURL', this.layer2Web3);
    let url = `${tallyServiceURL}/reward-tokens/${address}`;
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

  async getProofs(address: string, tokenAddress?: string): Promise<Proof[]> {
    let tallyServiceURL = await getConstant('tallyServiceURL', this.layer2Web3);
    let url = `${tallyServiceURL}/merkle-proofs/${address}` + (tokenAddress ? `?token_address=${tokenAddress}` : '');
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

  async rewardTokenBalance(address: string, tokenAddress: string): Promise<RewardTokenBalance> {
    let rewardTokensAvailable = await this.rewardTokensAvailable(address);
    if (!rewardTokensAvailable.includes(tokenAddress)) {
      throw new Error(`Payee does not have any reward token ${tokenAddress}`);
    }
    const tokenContract = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);
    let tokenSymbol = await tokenContract.methods.symbol().call();
    let proofs = await this.getProofs(address, tokenAddress);
    let rewardPool = await this.getRewardPool();
    let ungroupedTokenBalance = await Promise.all(
      proofs.map(async (o: Proof) => {
        const balance = await rewardPool.methods.balanceForProofWithAddress(o.tokenAddress, address, o.proof).call();
        // returns a string in wei amount
        return {
          tokenAddress: o.tokenAddress,
          tokenSymbol,
          balance: new BN(balance),
        };
      })
    );
    return aggregateBalance(ungroupedTokenBalance);
  }

  async rewardTokenBalances(address: string): Promise<RewardTokenBalance[]> {
    let rewardTokensAvailable = await this.rewardTokensAvailable(address);
    const ungroupedTokenBalance = await Promise.all(
      rewardTokensAvailable.map(async (tokenAddress: string) => {
        return this.rewardTokenBalance(address, tokenAddress);
      })
    );
    return ungroupedTokenBalance;
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
