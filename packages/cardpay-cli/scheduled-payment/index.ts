import type { Argv } from 'yargs';
import cancel from './cancel';
export const command = 'scheduled-payment <command>';
export const desc = 'Commands to interact with the scheduled payment module';
import enableModule from './enable-module';
import estimateExecution from './estimate-execution';

export const builder = function (yargs: Argv) {
  return yargs.command([cancel, enableModule, estimateExecution] as any);
};

export function handler(/* argv: Argv */) {
  throw new Error('You must specify a valid subcommand');
}
