import type { Argv } from 'yargs';
export const command = 'db <command>';
export const desc = 'Commands to manage the local database';

import { commands } from './db/index';

export const builder = function (yargs: Argv) {
  return yargs.command(commands);
};

export function handler(/* argv: Argv */) {}
