import type { Argv } from 'yargs';
import create from './create';
import creationGasFee from './creation-gas-fee';
import payMerchant from './pay-merchant';
import paymentLimits from './payment-limits';
import priceForFaceValue from './price-for-face-value';
import split from './split';
import splitEqually from './split-equally';
import transfer from './transfer';

export const command = 'prepaid-card <command>';
export const desc = 'Commands to interact with prepaid cards';

export const builder = function (yargs: Argv) {
  return yargs
    .command([
      create,
      creationGasFee,
      payMerchant,
      paymentLimits,
      priceForFaceValue,
      split,
      splitEqually,
      transfer,
    ] as any)
    .demandCommand(1, 'You must specify a valid subcommand');
};

export function handler(/* argv: Argv */) {
  throw new Error('You must specify a valid subcommand');
}
