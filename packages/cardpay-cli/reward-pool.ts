import { getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3 } from './utils';
import Web3 from 'web3';
const { fromWei } = Web3.utils;

export async function rewardTokenBalances(network: string, address: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardPool = await getSDK('RewardPool', web3);
  const tokenBalances = await rewardPool.rewardTokenBalances(address);
  displayRewardTokenBalance(address, tokenBalances);
}

function displayRewardTokenBalance(address: string, tokenBalances: any[]): void {
  console.log(`Reward balance for ${address}`);
  console.log('-------------------------');
  tokenBalances.map((o: any) => {
    console.log(`${o.tokenSymbol}: ${fromWei(o.balance)}`);
  });
}

export async function rewardTokensAvailable(network: string, address: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardPool = await getSDK('RewardPool', web3);
  await rewardPool.rewardTokensAvailable(address);
}
