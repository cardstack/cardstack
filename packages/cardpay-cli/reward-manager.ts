import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3, WithSymbol, addTokenSymbol } from './utils';
import { RewardProgramInfo, RewardTokenBalance } from '@cardstack/cardpay-sdk';
import { fromWei } from 'web3-utils';

export async function registerRewardProgram(
  network: string,
  prepaidCard: string,
  admin: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardManagerAPI = await getSDK('RewardManager', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  let { rewardProgramId } = await rewardManagerAPI.registerRewardProgram(prepaidCard, admin, {
    onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
  console.log(`Registered reward program ${rewardProgramId} with admin ${admin}`);
}

export async function registerRewardee(
  network: string,
  prepaidCard: string,
  rewardProgramId: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardManagerAPI = await getSDK('RewardManager', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  let { rewardSafe } = await rewardManagerAPI.registerRewardee(prepaidCard, rewardProgramId, {
    onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
  console.log(`Registered rewardee for reward program ${rewardProgramId}. Created reward safe: ${rewardSafe}`);
}

export async function lockRewardProgram(
  network: string,
  prepaidCard: string,
  rewardProgramId: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardManagerAPI = await getSDK('RewardManager', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  await rewardManagerAPI.lockRewardProgram(prepaidCard, rewardProgramId, {
    onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
  console.log(`Locked reward program ${rewardProgramId}`);
}

export async function isRewardProgramLocked(
  network: string,
  rewardProgramId: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardManager = await getSDK('RewardManager', web3);
  const locked = await rewardManager.isLocked(rewardProgramId);
  console.log(`Reward program ${rewardProgramId} is ${locked ? 'locked' : 'NOT locked'}`);
}

export async function updateRewardProgramAdmin(
  network: string,
  prepaidCard: string,
  rewardProgramId: string,
  newAdmin: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardManagerAPI = await getSDK('RewardManager', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  await rewardManagerAPI.updateRewardProgramAdmin(prepaidCard, rewardProgramId, newAdmin, {
    onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
  console.log(`Updated admin of reward program ${rewardProgramId} to ${newAdmin}`);
}

export async function addRewardRule(
  network: string,
  prepaidCard: string,
  rewardProgramId: string,
  blob: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardManagerAPI = await getSDK('RewardManager', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  await rewardManagerAPI.addRewardRule(prepaidCard, rewardProgramId, blob, {
    onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
  console.log(`Updated reward rule of reward program ${rewardProgramId} to ${blob}`);
}

export async function rewardProgramAdmin(network: string, rewardProgramId: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardManager = await getSDK('RewardManager', web3);
  const admin = await rewardManager.getRewardProgramAdmin(rewardProgramId);
  console.log(`Reward program admin of ${rewardProgramId} is ${admin}`);
}

export async function rewardRule(network: string, rewardProgramId: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardManager = await getSDK('RewardManager', web3);
  const rewardRule = await rewardManager.getRewardRule(rewardProgramId);
  console.log(`Reward Rule of ${rewardProgramId} is ${rewardRule}`);
}

export async function withdraw(
  network: string,
  rewardSafe: string,
  to: string,
  tokenAddress: string,
  amount: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardManagerAPI = await getSDK('RewardManager', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  await rewardManagerAPI.withdraw(rewardSafe, to, tokenAddress, amount, {
    onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
  console.log(`Withdraw ${amount} of ${tokenAddress} out of ${rewardSafe} to ${to}`);
}

export async function transferRewardSafe(
  network: string,
  rewardSafe: string,
  newOwner: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardManagerAPI = await getSDK('RewardManager', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  await rewardManagerAPI.transfer(rewardSafe, newOwner, {
    onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
  console.log(`Transfer reward safe ${rewardSafe} ownership to ${newOwner}`);
}

export async function viewRewardProgram(network: string, rewardProgramId: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardManagerAPI = await getSDK('RewardManager', web3);
  let rewardPoolAPI = await getSDK('RewardPool', web3);

  const rewardProgramInfo = await rewardManagerAPI.getRewardProgramInfo(rewardProgramId);
  let balances = await rewardPoolAPI.balances(rewardProgramId);
  let enhancedBalances = await addTokenSymbol(rewardPoolAPI, balances);
  displayRewardProgramInfo(rewardProgramInfo);
  displayRewardTokenBalance(enhancedBalances);
}

function displayRewardProgramInfo(rewardProgramInfo: RewardProgramInfo): void {
  let { rewardProgramId, rewardProgramAdmin, locked, rule } = rewardProgramInfo;
  console.log(`
RewardProgramInfo

  rewardProgramId : ${rewardProgramId}
  rewardProgramAdmin : ${rewardProgramAdmin}
  locked : ${locked}
  rule : ${rule ? rule : 'No rule found'}
  `);
}

function displayRewardTokenBalance(tokenBalances: WithSymbol<RewardTokenBalance>[]): void {
  console.log(`  balance:`);
  tokenBalances.map(({ tokenSymbol, balance }) => {
    console.log(`    ${tokenSymbol} : ${fromWei(balance)}`);
  });
}
