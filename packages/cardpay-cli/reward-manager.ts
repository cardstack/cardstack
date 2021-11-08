import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3 } from './utils';

export async function registerRewardProgram(
  network: string,
  prepaidCard: string,
  admin: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let prepaidCardAPI = await getSDK('PrepaidCard', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  let { rewardProgramId } = await prepaidCardAPI.registerRewardProgram(prepaidCard, admin, {
    onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
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
  let prepaidCardAPI = await getSDK('PrepaidCard', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  let { rewardSafe } = await prepaidCardAPI.registerRewardee(prepaidCard, rewardProgramId, {
    onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
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
  let prepaidCardAPI = await getSDK('PrepaidCard', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  await prepaidCardAPI.lockRewardProgram(prepaidCard, rewardProgramId, {
    onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
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
  let prepaidCardAPI = await getSDK('PrepaidCard', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  await prepaidCardAPI.updateRewardProgramAdmin(prepaidCard, rewardProgramId, newAdmin, {
    onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
}

export async function rewardProgramAdmin(network: string, rewardProgramId: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardManager = await getSDK('RewardManager', web3);
  const admin = await rewardManager.getRewardProgramAdmin(rewardProgramId);
  console.log(`Reward program admin of ${rewardProgramId} is ${admin}`);
}
