import { Argv } from 'yargs';
import { fromWei, getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3, NETWORK_OPTION_LAYER_2 } from '../utils';
import { Arguments, CommandModule } from 'yargs';

export default {
  command: 'price-for-face-value <tokenAddress> <spendFaceValue>',
  describe:
    'Get the price in the units of the specified token to achieve a prepaid card with the specified face value in SPEND',
  builder(yargs: Argv) {
    return yargs
      .positional('tokenAddress', {
        type: 'string',
        description: 'The token address of the token that will be used to pay for the prepaid card',
      })
      .positional('spendFaceValue', {
        type: 'number',
        description: 'The desired face value in SPEND for the prepaid card',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, mnemonic, tokenAddress, spendFaceValue, trezor } = args as unknown as {
      network: string;
      tokenAddress: string;
      spendFaceValue: number;
      mnemonic?: string;
      trezor?: boolean;
    };
    let web3 = await getWeb3(network, mnemonic, trezor);
    let prepaidCard = await getSDK('PrepaidCard', web3);
    let weiAmount = await prepaidCard.priceForFaceValue(tokenAddress, spendFaceValue);
    console.log(
      `To achieve a SPEND face value of §${spendFaceValue} you must send ${fromWei(weiAmount)} units of this token`
    );
  },
} as CommandModule;
