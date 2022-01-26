import type { Argv } from 'yargs';
import register from './register';
import revenueBalances from './revenue-balances';
import claimRevenue from './claim-revenue';
import claimRevenueGasEstimate from './claim-revenue-gas-estimate';

export const command = 'merchant <command>';
export const desc = 'Commands to interact with merchant safes and revenue pools';

export const builder = function (yargs: Argv) {
  return yargs
    .command([claimRevenue, claimRevenueGasEstimate, register, revenueBalances] as any)
    .demandCommand(1, 'You must specify a valid subcommand');
};

export function handler(/* argv: Argv */) {
  throw new Error('You must specify a valid subcommand');
}
