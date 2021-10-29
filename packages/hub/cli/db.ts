import type { Argv } from 'yargs';
export const command = 'db <command>';
export const desc = 'Commands to manage the local database';

export function builder(yargs: Argv) {
  return yargs.commandDir('./db');
}

export function handler(/* argv: Argv */) {}
