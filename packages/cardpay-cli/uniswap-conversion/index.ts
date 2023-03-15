import type { Argv } from 'yargs';
import nativeToToken from './native-to-token';
import usdcToToken from './usdc-to-token';
export const command = 'uniswap-conversion <command>';
export const desc = 'Commands to convert tokens using uniswap v2';

export const builder = function (yargs: Argv) {
  return yargs.command([nativeToToken, usdcToToken] as any);
};

export function handler(/* argv: Argv */) {
  throw new Error('You must specify a valid subcommand');
}
