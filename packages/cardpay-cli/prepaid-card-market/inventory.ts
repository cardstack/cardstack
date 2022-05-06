import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'inventory <sku>',
  describe: 'Get the inventory for a specific SKU from the market contract',
  builder(yargs: Argv) {
    return yargs
      .positional('sku', {
        type: 'string',
        description: 'The SKU to obtain inventory for',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, sku } = args as unknown as {
      network: string;
      sku: string;
    };
    let { web3 } = await getEthereumClients(network, getConnectionType(args));
    let prepaidCardMarket = await getSDK('PrepaidCardMarket', web3);
    let inventory = await prepaidCardMarket.getInventory(sku);
    console.log(`Inventory for SKU ${sku} (${inventory.length} items):
      ${inventory.map((p) => p.address).join(',\n  ')}`);
  },
} as CommandModule;
