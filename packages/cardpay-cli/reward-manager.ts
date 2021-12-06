import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3 } from './utils';

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
  console.log('done');
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
  console.log('done');
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
  const admin = await rewardManager.getRewardRule(rewardProgramId);
  console.log(`Reward Rule of ${rewardProgramId} is ${admin}`);
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
  console.log('done');
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
  console.log('done');
}
