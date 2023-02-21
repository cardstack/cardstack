import type { Argv } from 'yargs';
import createSafe from './create-safe';
import enableModule from './enable-module';
import details from './details';

export const command = 'claim-settlement <command>';
export const desc = 'Commands to interact with the claim settlement module';

export const builder = function (yargs: Argv) {
  return yargs.command([createSafe, enableModule, details] as any);
};

export function handler(/* argv: Argv */) {
  throw new Error('You must specify a valid subcommand');
}
