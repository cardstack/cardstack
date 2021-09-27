import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3 } from './utils';
import Web3 from 'web3';
const { fromWei } = Web3.utils;
import { RewardTokenBalance } from '@cardstack/cardpay-sdk/sdk/reward-pool';

export async function rewardTokenBalances(
  network: string,
  address: string,
  rewardProgramId?: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardPool = await getSDK('RewardPool', web3);
  if (rewardProgramId) {
    const tokenBalances = await rewardPool.rewardTokenBalances(address, rewardProgramId);
    console.log('\n');
    console.log(`Reward balances for ${address}`);
    console.log('---------------------------------------------------------------------');
    console.log(`  Reward program: ${rewardProgramId}`);
    console.log('---------------------------------------------------------------------');
    displayRewardTokenBalance(tokenBalances);
  } else {
    const tokenBalances = await rewardPool.rewardTokenBalances(address);
    console.log(tokenBalances)
    // find reward programs
  }
}

function displayRewardTokenBalance(tokenBalances: RewardTokenBalance[]): void {
  tokenBalances.map((o: any) => {
    console.log(`    ${o.tokenSymbol}: ${fromWei(o.balance)}`);
  });
  console.log('---------------------------------------------------------------------');
}

export async function rewardTokensAvailable(network: string, address: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardPool = await getSDK('RewardPool', web3);
  await rewardPool.rewardTokensAvailable(address);
}

export async function addRewardTokens(
  network: string,
  safe: string,
  rewardProgramId: string,
  tokenAddress: string,
  amount: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardPool = await getSDK('RewardPool', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  await rewardPool.addRewardTokens(safe, rewardProgramId, tokenAddress, amount, {
    onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
  console.log(`Added ${amount} of token ${tokenAddress} to reward program ${rewardProgramId}`);
  console.log('done');
}

export async function rewardPoolBalance(
  network: string,
  rewardProgramId: string,
  tokenAddress: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardPool = await getSDK('RewardPool', web3);
  let balance = await rewardPool.balance(rewardProgramId, tokenAddress);
  // let rewardPoolAddress = await rewardPool.address();
  displayRewardTokenBalance([balance]);
}

export async function claimRewards(
  network: string,
  rewardSafeAddress: string,
  rewardProgramId: string,
  tokenAddress: string,
  proof: string,
  amount: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardPool = await getSDK('RewardPool', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  await rewardPool.claim(rewardSafeAddress, rewardProgramId, tokenAddress, proof, amount, {
    onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
  console.log(
    `Claimed ${amount} of token ${tokenAddress} to reward safe ${rewardSafeAddress} for reward program ${rewardProgramId}`
  );
  console.log('done');
}
