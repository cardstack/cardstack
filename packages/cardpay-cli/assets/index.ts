import type { Argv } from 'yargs';
import tokenBalance from './token-balance';

export const command = 'assets <command>';
export const desc = 'Commands to get asset balances';

export const builder = function (yargs: Argv) {
  return yargs.command([tokenBalance] as any).demandCommand(1, 'You must specify a valid subcommand');
};

export function handler(/* argv: Argv */) {
  throw new Error('You must specify a valid subcommand');
}
