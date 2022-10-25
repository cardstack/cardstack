import { Argv } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { Arguments, CommandModule } from 'yargs';

export default {
  command: 'create-safe-estimation',
  describe: 'Estimate gas limit to create a new safe with SP module and meta guard installed',
  builder(yargs: Argv) {
    return yargs.option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let { network } = args as unknown as {
      network: string;
    };
    let { ethersProvider, signer } = await getEthereumClients(network, getConnectionType(args));
    let scheduledPaymentModule = await getSDK('ScheduledPaymentModule', ethersProvider, signer);
    console.log(`Estimate gas limit to create a new safe and install SP module and meta guard...`);
    let gasLimit = await scheduledPaymentModule.createSafeWithModuleAndGuardEstimation();
    console.log(`Gas limit: ${gasLimit}`);
  },
} as CommandModule;
