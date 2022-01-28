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
