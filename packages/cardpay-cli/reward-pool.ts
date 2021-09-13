import { getSDK, RewardPool } from '@cardstack/cardpay-sdk';
import { getWeb3 } from './utils';
import Web3 from 'web3';
const { fromWei } = Web3.utils;
import { RewardTokenBalance } from '@cardstack/cardpay-sdk/sdk/reward-pool';

export async function rewardTokenBalances(network: string, address: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardPool = await getSDK<RewardPool>('RewardPool', web3);
  const tokenBalances = await rewardPool.rewardTokenBalances(address);
  displayRewardTokenBalance(address, tokenBalances);
}

function displayRewardTokenBalance(address: string, tokenBalances: RewardTokenBalance[]): void {
  console.log(`Reward balance for ${address}`);
  console.log('-------------------------');
  tokenBalances.map((o: any) => {
    console.log(`${o.tokenSymbol}: ${fromWei(o.balance)}`);
  });
}

export async function rewardTokensAvailable(network: string, address: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardPool = await getSDK<RewardPool>('RewardPool', web3);
  await rewardPool.rewardTokensAvailable(address);
}
