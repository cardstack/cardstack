import { Argv } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3 } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { displaySafe } from './utils';

export default {
  command: 'view [safeAddress]',
  describe: 'View contents of the safe at the specified address',
  builder(yargs: Argv) {
    return yargs.positional('safeAddress', {
      type: 'string',
      description: 'The address of the safe to view',
    });
  },
  async handler(args: Arguments) {
    let { network, mnemonic, safeAddress } = args as unknown as {
      network: string;
      mnemonic?: string;
      safeAddress: string;
    };
    let web3 = await getWeb3(network, mnemonic);

    let safesApi = await getSDK('Safes', web3);
    console.log(`Getting safe ${safeAddress}`);
    let safe = (await safesApi.viewSafe(safeAddress)).safe;
    console.log();
    if (!safe) {
      console.log(`The address ${safeAddress} is not a safe`);
    } else {
      displaySafe(safeAddress, safe);
    }

    console.log();
  },
} as CommandModule;
