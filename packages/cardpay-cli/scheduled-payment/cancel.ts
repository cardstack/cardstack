import { Argv } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { Arguments, CommandModule } from 'yargs';

export default {
  command: 'cancel-payment <scheduledPaymentId>',
  describe:
    'Cancels a scheduled payment by updating it in the crank and removing the scheduled payment hash from the payment module contract',
  builder(yargs: Argv) {
    return yargs
      .positional('scheduledPaymentId', {
        type: 'string',
        description: 'The id of the scheduled payment to be canceled (uuid of the record in the crank)',
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let { network, scheduledPaymentId } = args as unknown as {
      network: string;
      scheduledPaymentId: string;
    };

    console.log(`Canceling scheduled payment ${scheduledPaymentId}...`);

    let { ethersProvider, signer } = await getEthereumClients(network, getConnectionType(args));
    let scheduledPaymentModule = await getSDK('ScheduledPaymentModule', ethersProvider, signer);

    await scheduledPaymentModule.cancelScheduledPayment(scheduledPaymentId);

    console.log(`Scheduled payment canceled successfully.`);
  },
} as CommandModule;
