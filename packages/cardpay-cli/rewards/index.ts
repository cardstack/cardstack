import type { Argv } from 'yargs';
import * as admin from './admin';
import claim from './claim';
import claimableProofs from './claimable-proofs';
import list from './list';
import poolBalances from './pool-balances';
import register from './register';
import rewardBalances from './reward-balances';
import transferSafe from './transfer-safe';
import withdrawFromSafe from './withdraw-from-safe';
import view from './view';
import registerRewardeeGasEstimate from './register-rewardee-gas-estimate';
import claimRewardGasEstimate from './claim-reward-gas-estimate';
import withdrawGasEstimate from './withdraw-gas-estimate';

export const command = 'rewards <command>';
export const desc = 'Commands to get interact with the reward programs and the reward manager contract';

export const builder = function (yargs: Argv) {
  return yargs
    .command([
      admin,
      claim,
      claimableProofs,
      list,
      poolBalances,
      register,
      rewardBalances,
      transferSafe,
      withdrawFromSafe,
      view,
      registerRewardeeGasEstimate,
      claimRewardGasEstimate,
      withdrawGasEstimate,
    ] as any)
    .demandCommand(1, 'You must specify a valid subcommand');
};

export function handler(/* argv: Argv */) {
  throw new Error('You must specify a valid subcommand');
}
