import type { Argv } from 'yargs';
import cancel from './cancel';
import createSafe from './create-safe';
import createSafeEstimation from './create-safe-estimation';
import createSpHash from './create-sp-hash';
export const command = 'scheduled-payment <command>';
export const desc = 'Commands to interact with the scheduled payment module';
import enableModule from './enable-module';
import estimateExecution from './estimate-execution';
import estimateExecutionWithNoAmount from './estimate-execution-with-no-amount';
import estimateGas from './estimate-gas';
import execute from './execute';
import schedulePayment from './schedule-payment';

export const builder = function (yargs: Argv) {
  return yargs.command([
    cancel,
    createSafe,
    createSafeEstimation,
    createSpHash,
    enableModule,
    estimateExecution,
    estimateExecutionWithNoAmount,
    estimateGas,
    execute,
    schedulePayment,
  ] as any);
};

export function handler(/* argv: Argv */) {
  throw new Error('You must specify a valid subcommand');
}
