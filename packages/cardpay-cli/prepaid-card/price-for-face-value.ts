import { Argv } from 'yargs';
import { fromWei, getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
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
    let { network, tokenAddress, spendFaceValue } = args as unknown as {
      network: string;
      tokenAddress: string;
      spendFaceValue: number;
    };
    let { web3 } = await getEthereumClients(network, getConnectionType(args));
    let prepaidCard = await getSDK('PrepaidCard', web3);
    let weiAmount = await prepaidCard.priceForFaceValue(tokenAddress, spendFaceValue);
    console.log(
      `To achieve a SPEND face value of §${spendFaceValue} you must send ${fromWei(weiAmount)} units of this token`
    );
  },
} as CommandModule;
