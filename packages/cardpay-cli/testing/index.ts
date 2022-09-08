import type { Argv } from 'yargs';
export const command = 'testing <command>';
export const desc = 'Commands to interact with testing';
import createAccount from './create-account';

export const builder = function (yargs: Argv) {
  return yargs
    .command([createAccount] as any) // cast to work around missing override in types
    .demandCommand(1, 'You must specify a valid subcommand');
};

export function handler(/* argv: Argv */) {
  throw new Error('You must specify a valid subcommand');
}
