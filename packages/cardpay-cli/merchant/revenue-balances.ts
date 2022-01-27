import { Argv } from 'yargs';
import { getWeb3 } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import { fromWei } from 'web3-utils';

export default {
  command: 'revenue-balances <merchantSafe>',
  describe: 'View token balances of unclaimed revenue in the revenue pool for a merchant',
  builder(yargs: Argv) {
    return yargs.positional('merchantSafe', {
      type: 'string',
      description: "The address of the merchant's safe whose balances are to be viewed",
    });
  },
  async handler(args: Arguments) {
    let { network, mnemonic, merchantSafe } = args as unknown as {
      network: string;
      merchantSafe: string;
      mnemonic?: string;
    };
    let web3 = await getWeb3(network, mnemonic);
    let revenuePool = await getSDK('RevenuePool', web3);
    let balanceInfo = await revenuePool.balances(merchantSafe);
    console.log(`Merchant revenue balance for merchant safe ${merchantSafe}:`);
    for (let { tokenSymbol, balance } of balanceInfo) {
      console.log(`${fromWei(balance)} ${tokenSymbol}`);
    }
  },
} as CommandModule;
