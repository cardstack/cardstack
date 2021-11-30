import type { Argv } from 'yargs';
export const command = 'db <command>';
export const desc = 'Commands to manage the local database';

export const builder = function (yargs: Argv) {
  return yargs.commandDir('./db');
};

export function handler(/* argv: Argv */) {}
