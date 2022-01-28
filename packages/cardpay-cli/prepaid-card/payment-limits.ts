import { getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3 } from '../utils';
import { Arguments, CommandModule } from 'yargs';

export default {
  command: 'payment-limits',
  describe: 'Get the minimum and maximum prepaid card payment limits in SPEND',
  builder: {},
  async handler(args: Arguments) {
    let { network, mnemonic } = args as unknown as {
      network: string;
      mnemonic?: string;
    };
    let web3 = await getWeb3(network, mnemonic);
    let prepaidCard = await getSDK('PrepaidCard', web3);
    let { min, max } = await prepaidCard.getPaymentLimits();
    console.log(`The prepaid card payments limits are:
      minimum amount §${min} SPEND
      maximum amount §${max} SPEND`);
  },
} as CommandModule;
