import { getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3, NETWORK_OPTION_LAYER_2 } from '../utils';
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
    let { network, mnemonic, trezor } = args as unknown as {
      network: string;
      mnemonic?: string;
      trezor?: boolean;
    };
    let web3 = await getWeb3(network, mnemonic, trezor);
    let prepaidCard = await getSDK('PrepaidCard', web3);
    let { min, max } = await prepaidCard.getPaymentLimits();
    console.log(`The prepaid card payments limits are:
      minimum amount §${min} SPEND
      maximum amount §${max} SPEND`);
  },
} as CommandModule;
