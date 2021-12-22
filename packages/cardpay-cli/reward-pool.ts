import { getWeb3 } from './utils';
import { Proof, RewardTokenBalance, getSDK, getConstant, WithSymbol } from '@cardstack/cardpay-sdk';
import { fromWei } from 'web3-utils';
import groupBy from 'lodash/groupBy';

export async function rewardTokenBalances(
  network: string,
  address: string,
  rewardProgramId?: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardPool = await getSDK('RewardPool', web3);
  const tokenBalances = await rewardPool.rewardTokenBalances(address, rewardProgramId);
  console.log(`Reward balances for ${address}`);
  displayRewardTokenBalance(tokenBalances);
}

function displayRewardTokenBalance(tokenBalances: WithSymbol<RewardTokenBalance>[]): void {
  const groupedByRewardProgram = groupBy(tokenBalances, (a) => a.rewardProgramId);
  Object.keys(groupedByRewardProgram).map((rewardProgramId: string) => {
    console.log(`---------------------------------------------------------------------
  RewardProgram: ${rewardProgramId}
---------------------------------------------------------------------`);
    let p = groupedByRewardProgram[rewardProgramId];
    p.map((o) => {
      console.log(`  ${o.tokenSymbol}: ${fromWei(o.balance)}`);
    });
  });
}

function displayProofs(proofs: WithSymbol<Proof>[]): void {
  const groupedByRewardProgram = groupBy(proofs, (a) => a.rewardProgramId);
  Object.keys(groupedByRewardProgram).map((rewardProgramId: string) => {
    console.log(`---------------------------------------------------------------------
  RewardProgram: ${rewardProgramId}
---------------------------------------------------------------------`);
    let p = groupedByRewardProgram[rewardProgramId];
    p.map((o) => {
      console.log(`
      proof: ${fromProofArray(o.proofArray)}
      leaf: ${o.leaf}
      balance: ${fromWei(o.amount)} ${o.tokenSymbol}
      token: ${o.tokenAddress} (${o.tokenSymbol})
        `);
    });
  });
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
  let assets = await getSDK('Assets', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  await rewardPool.addRewardTokens(safe, rewardProgramId, tokenAddress, amount, {
    onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
  let { symbol } = await assets.getTokenInfo(tokenAddress);
  console.log(`Added ${amount} of token ${symbol} to reward program ${rewardProgramId}`);
}

export async function rewardPoolBalance(network: string, rewardProgramId: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardPool = await getSDK('RewardPool', web3);
  let rewardTokenBalances = await rewardPool.balances(rewardProgramId);
  displayRewardTokenBalance(rewardTokenBalances);
}

export async function getClaimableRewardProofs(
  network: string,
  address: string,
  rewardProgramId?: string,
  tokenAddress?: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardPool = await getSDK('RewardPool', web3);
  const proofs = await rewardPool.getProofs(address, rewardProgramId, tokenAddress, false);
  displayProofs(proofs);
}

export async function claimRewards(
  network: string,
  rewardSafeAddress: string,
  leaf: string,
  proof: string,
  acceptPartialClaim?: boolean,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardPool = await getSDK('RewardPool', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  let proofArray = fromProof(proof);
  await rewardPool.claim(rewardSafeAddress, leaf, proofArray, acceptPartialClaim, {
    onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
  console.log(`Claimed reward to safe ${rewardSafeAddress}`);
}

export async function recoverRewardTokens(
  network: string,
  safeAddress: string,
  rewardProgramId: string,
  tokenAddress: string,
  amount?: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardPool = await getSDK('RewardPool', web3);
  let assets = await getSDK('Assets', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  await rewardPool.recoverTokens(safeAddress, rewardProgramId, tokenAddress, amount, {
    onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
  let { symbol } = await assets.getTokenInfo(tokenAddress);
  console.log(
    `Recover ${amount ? amount : ''} ${symbol} for reward program id ${rewardProgramId} to safe ${safeAddress}`
  );
}

const fromProofArray = (arr: string[]): string => {
  return (
    '0x' +
    arr.reduce((proof, s) => {
      return proof.concat(s.replace('0x', ''));
    }, '')
  );
};

const fromProof = (proof: string): any => {
  if (proof == '0x') {
    return [];
  }
  let bytesSize = 32;
  let hexChunkSize = bytesSize * 2;
  let hexStr = proof.replace('0x', '');
  if (hexStr.length % hexChunkSize != 0) {
    throw new Error('proof array is wrong size');
  }
  return chunkString(hexStr, hexChunkSize).map((s) => '0x' + s);
};

function chunkString(str: string, chunkSize: number) {
  let arr = str.match(new RegExp('.{1,' + chunkSize + '}', 'g'));
  if (arr) {
    return arr;
  } else {
    throw new Error('proof cannot be converted to proof array  split properly');
  }
}
