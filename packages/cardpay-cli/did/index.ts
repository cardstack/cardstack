import type { Argv } from 'yargs';
import encodeDid from './encode';
import resolve from './resolve';
import resolveAka from './resolve-aka';
export const command = 'did <command>';
export const desc = 'Commands to work with cardstack decentralized identitifiers (DIDs)';

export const builder = function (yargs: Argv) {
  return yargs.command([resolve, resolveAka, encodeDid] as any).demandCommand(1, 'You must specify a valid subcommand');
};

export function handler(/* argv: Argv */) {
  throw new Error('You must specify a valid subcommand');
}
