import { getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
import { Arguments, Argv, CommandModule } from 'yargs';

export default {
  command: 'payment-limits',
  describe: 'Get the minimum and maximum prepaid card payment limits in SPEND',
  builder(yargs: Argv) {
    return yargs.options({
      network: NETWORK_OPTION_LAYER_2,
    });
  },
  async handler(args: Arguments) {
    let { network } = args as unknown as {
      network: string;
    };
    let { web3 } = await getEthereumClients(network, getConnectionType(args));
    let prepaidCard = await getSDK('PrepaidCard', web3);
    let { min, max } = await prepaidCard.getPaymentLimits();
    console.log(`The prepaid card payments limits are:
      minimum amount §${min} SPEND
      maximum amount §${max} SPEND`);
  },
} as CommandModule;
