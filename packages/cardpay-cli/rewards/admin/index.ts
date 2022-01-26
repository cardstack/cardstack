import type { Argv } from 'yargs';
import addTokens from './add-tokens';
import addRule from './add-rule';
import createProgram from './create-program';
import lock from './lock';
import recoverRewardTokens from './recover-reward-tokens';
import setAdmin from './set-admin';

export const command = 'admin <command>';
export const desc = 'Commands to administrate reward programs';

export const builder = function (yargs: Argv) {
  return yargs
    .command([addTokens, addRule, createProgram, lock, recoverRewardTokens, setAdmin] as any)
    .demandCommand(1, 'You must specify a valid subcommand');
};

export function handler(/* argv: Argv */) {
  throw new Error('You must specify a valid subcommand');
}
