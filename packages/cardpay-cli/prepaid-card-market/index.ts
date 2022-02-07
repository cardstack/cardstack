import type { Argv } from 'yargs';
import add from './add';
import inventory from './inventory';
import inventories from './inventories';
import provision from './provision';
import remove from './remove';
import setAsk from './set-ask';
import skuInfo from './sku-info';

export const command = 'prepaid-card-market <command>';
export const desc = 'Commands to interact with prepaid card market';

export const builder = function (yargs: Argv) {
  return yargs
    .command([add, inventory, inventories, provision, remove, setAsk, skuInfo] as any)
    .demandCommand(1, 'You must specify a valid subcommand');
};

export function handler(/* argv: Argv */) {
  throw new Error('You must specify a valid subcommand');
}
