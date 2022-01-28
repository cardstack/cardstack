import { Argv } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3 } from '../utils';
import { Arguments, CommandModule } from 'yargs';

export default {
  command: 'pay-merchant <merchantSafe> <prepaidCard> <spendAmount>',
  describe: 'Pay a merchant from a prepaid card',
  builder(yargs: Argv) {
    return yargs
      .positional('merchantSafe', {
        type: 'string',
        description: "The address of the merchant's safe who will receive the payment",
      })
      .positional('prepaidCard', {
        type: 'string',
        description: 'The address of the prepaid card that is being used to pay the merchant',
      })
      .positional('spendAmount', {
        type: 'number',
        description: 'The amount to send to the merchant in units of SPEND',
      });
  },
  async handler(args: Arguments) {
    let { network, mnemonic, merchantSafe, prepaidCard, spendAmount } = args as unknown as {
      network: string;
      merchantSafe: string;
      prepaidCard: string;
      spendAmount: number;
      mnemonic?: string;
    };
    let web3 = await getWeb3(network, mnemonic);
    let prepaidCardSdk = await getSDK('PrepaidCard', web3);
    let blockExplorer = await getConstant('blockExplorer', web3);

    console.log(
      `Paying merchant safe address ${merchantSafe} the amount §${spendAmount} SPEND from prepaid card address ${prepaidCard}...`
    );
    await prepaidCardSdk.payMerchant(merchantSafe, prepaidCard, spendAmount, {
      onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
    });
    console.log('done');
  },
} as CommandModule;
