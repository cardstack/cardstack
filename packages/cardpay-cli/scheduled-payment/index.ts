import type { Argv } from 'yargs';
import createSafe from './create-safe';
import createSpHash from './create-sp-hash';
export const command = 'scheduled-payment <command>';
export const desc = 'Commands to interact with the scheduled payment module';
import enableModule from './enable-module';
import estimateExecution from './estimate-execution';
import schedulePayment from './schedule-payment';

export const builder = function (yargs: Argv) {
  return yargs.command([createSafe, createSpHash, enableModule, estimateExecution, schedulePayment] as any);
};

export function handler(/* argv: Argv */) {
  throw new Error('You must specify a valid subcommand');
}
