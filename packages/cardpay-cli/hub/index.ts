import type { Argv } from 'yargs';
export const command = 'hub <command>';
export const desc = 'Commands to interact with the hub server';
import auth from './auth';

export const builder = function (yargs: Argv) {
  return yargs.command(auth).demandCommand(1, 'You must specify a valid subcommand');
};

export function handler(/* argv: Argv */) {
  throw new Error('You must specify a valid subcommand');
}
