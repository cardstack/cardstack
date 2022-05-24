import type { Argv } from 'yargs';
import addTokens from './add-tokens';
import addSku from './add-sku';
import getQuantity from './get-quantity';
import getSKU from './get-sku';
import setAsk from './set-ask';

export const command = 'prepaid-card-market-v2 <command>';
export const desc = 'Commands to interact with prepaid card market';

export const builder = function (yargs: Argv) {
  return yargs
    .command([addTokens, addSku, getQuantity, getSKU, setAsk] as any)
    .demandCommand(1, 'You must specify a valid subcommand');
};

export function handler(/* argv: Argv */) {
  throw new Error('You must specify a valid subcommand');
}
