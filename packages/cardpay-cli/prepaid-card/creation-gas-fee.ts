import { Argv } from 'yargs';
import { fromWei, getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3, NETWORK_OPTION_LAYER_2 } from '../utils';
import { Arguments, CommandModule } from 'yargs';

export default {
  command: 'creation-gas-fee <tokenAddress>',
  describe: 'Get the gas fee in the units of the specified token for creating a new prepaid card',
  builder(yargs: Argv) {
    return yargs
      .positional('tokenAddress', {
        type: 'string',
        description: 'The token address of the token that will be used to pay for the prepaid card',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { network, mnemonic, tokenAddress, trezor } = args as unknown as {
      network: string;
      tokenAddress: string;
      mnemonic?: string;
      trezor?: boolean;
    };
    let web3 = await getWeb3(network, mnemonic, trezor);
    let prepaidCard = await getSDK('PrepaidCard', web3);
    let weiAmount = await prepaidCard.gasFee(tokenAddress);
    console.log(`The gas fee for a new prepaid card in units of this token is ${fromWei(weiAmount)}`);
  },
} as CommandModule;
