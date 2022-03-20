import { Argv } from 'yargs';
import { getSDK, Safe } from '@cardstack/cardpay-sdk';
import { getWeb3, NETWORK_OPTION_LAYER_2, getWeb3Opts } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { displaySafe } from './utils';

export default {
  command: 'list [address] [safeType]',
  describe: 'View contents of the safes owned by the specified address (or default wallet account)',
  builder(yargs: Argv) {
    return yargs
      .positional('address', {
        type: 'string',
        description: "The address of the safe owner. This defaults to your wallet's default account when not provided",
      })
      .positional('safeType', {
        type: 'string',
        description: "The type of safe to view: 'depot', 'merchant', 'prepaid-card', 'reward'",
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, address, safeType } = args as unknown as {
      network: string;
      address?: string;
      safeType?: Exclude<Safe['type'], 'external'>;
    };
    if (!safeType && address && !address.startsWith('0x')) {
      safeType = address as Exclude<Safe['type'], 'external'>;
      address = undefined;
    }
    if (safeType && !['depot', 'merchant', 'prepaid-card', 'reward'].includes(safeType)) {
      throw new Error(`Invalid safe type: ${safeType}`);
    }
    let web3Opts = getWeb3Opts(args);
    let web3 = await getWeb3(network, web3Opts);
    address = address || undefined;

    let safesApi = await getSDK('Safes', web3);
    console.log(`Getting ${safeType ? safeType + ' ' : ''}safes...`);
    console.log();
    let safes = (await safesApi.view(address, { type: safeType })).safes.filter((safe) => safe.type !== 'external');
    if (safes.length === 0) {
      console.log('Found no safes (not counting safes external to the cardpay protocol)');
    }
    safes.forEach((safe) => {
      displaySafe(safe.address, safe);
      console.log();
    });
  },
} as CommandModule;
