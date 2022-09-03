import type { Argv } from 'yargs';
export const command = 'scheduled-payment <command>';
export const desc = 'Commands to interact with the scheduled payment module';
import enableModule from './enable-module';

export const builder = function (yargs: Argv) {
  return yargs.command([enableModule] as any);
};

export function handler(/* argv: Argv */) {
  throw new Error('You must specify a valid subcommand');
}
