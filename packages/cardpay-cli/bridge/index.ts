import type { Argv } from 'yargs';
export const command = 'bridge <command>';
export const desc = 'Commands to interact with the cardpay bridge';
import awaitToL1 from './await-to-l1';
import awaitToL2 from './await-to-l2';
import claimOnL1 from './claim-on-l1';
import toL1 from './to-l1';
import toL2 from './to-l2';
import withdrawalLimits from './withdrawal-limits';

export const builder = function (yargs: Argv) {
  return yargs
    .command([awaitToL1, awaitToL2, claimOnL1, toL1, toL2, withdrawalLimits] as any) // cast to work around missing override in types
    .demandCommand(1, 'You must specify a valid subcommand');
};

export function handler(/* argv: Argv */) {
  throw new Error('You must specify a valid subcommand');
}
