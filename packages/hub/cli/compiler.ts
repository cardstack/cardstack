import type { Argv } from 'yargs';

export const command = 'compiler <command>';
export const desc = 'Commands related to the compiling of cards';

export function builder(yargs: Argv) {
  return yargs.commandDir('./compiler');
}

export function handler(/* argv: Argv */) {}
