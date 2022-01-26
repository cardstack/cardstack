import type { Argv } from 'yargs';
import eth from './eth';
import updatedAt from './updated-at';
import usd from './usd';

export const command = 'price <command>';
export const desc = 'Commands to interact with pricing oracles';

export const builder = function (yargs: Argv) {
  return yargs.command([eth, updatedAt, usd] as any).demandCommand(1, 'You must specify a valid subcommand');
};

export function handler(/* argv: Argv */) {
  throw new Error('You must specify a valid subcommand');
}
