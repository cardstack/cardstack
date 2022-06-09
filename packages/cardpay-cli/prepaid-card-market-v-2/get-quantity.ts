import { Argv } from 'yargs';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { Arguments, CommandModule } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'get-quantity <sku>',
  describe: 'Get quantity of available cards for a SKU',
  builder(yargs: Argv) {
    return yargs
      .positional('sku', {
        type: 'string',
        description: `Prepaid card's SKU`,
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, sku } = args as unknown as {
      network: string;
      sku: string;
    };
    let { web3, signer } = await getEthereumClients(network, getConnectionType(args));
    let prepaidCardMarketV2 = await getSDK('PrepaidCardMarketV2', web3, signer);

    let quantity = await prepaidCardMarketV2.getQuantity(sku);
    console.log(quantity);
  },
} as CommandModule;
