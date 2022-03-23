import { RewardTokenBalance, WithSymbol } from '@cardstack/cardpay-sdk';
import groupBy from 'lodash/groupBy';
import { fromWei } from 'web3-utils';
import { RewardProgramInfo } from '@cardstack/cardpay-sdk';

export function displayRewardTokenBalance(tokenBalances: WithSymbol<RewardTokenBalance>[]): void {
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

export function displayRewardProgramInfo(rewardProgramInfo: RewardProgramInfo): void {
  let { rewardProgramId, rewardProgramAdmin, locked, rule, tokenBalances } = rewardProgramInfo;
  console.log(`
  rewardProgramId : ${rewardProgramId}
  rewardProgramAdmin : ${rewardProgramAdmin}
  locked : ${locked}
  rule : ${rule ? rule : 'No rule'}
  ${tokenBalances.length > 0 ? 'balance:' : 'balance: No balance'}
  `);
  tokenBalances.map(({ tokenSymbol, balance }) => {
    console.log(`    ${tokenSymbol} : ${fromWei(balance)}`);
  });
}

export const fromProof = (proof: string): any => {
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
