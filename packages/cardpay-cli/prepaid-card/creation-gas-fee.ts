import { Argv } from 'yargs';
import { fromWei, getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3 } from '../utils';
import { Arguments, CommandModule } from 'yargs';

export default {
  command: 'creation-gas-fee <tokenAddress>',
  describe: 'Get the gas fee in the units of the specified token for creating a new prepaid card',
  builder(yargs: Argv) {
    return yargs.positional('tokenAddress', {
      type: 'string',
      description: 'The token address of the token that will be used to pay for the prepaid card',
    });
  },
  async handler(args: Arguments) {
    let { network, mnemonic, tokenAddress } = args as unknown as {
      network: string;
      tokenAddress: string;
      mnemonic?: string;
    };
    let web3 = await getWeb3(network, mnemonic);
    let prepaidCard = await getSDK('PrepaidCard', web3);
    let weiAmount = await prepaidCard.gasFee(tokenAddress);
    console.log(`The gas fee for a new prepaid card in units of this token is ${fromWei(weiAmount)}`);
  },
} as CommandModule;
