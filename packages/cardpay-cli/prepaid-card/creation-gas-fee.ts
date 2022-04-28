import { Argv } from 'yargs';
import { fromWei, getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, NETWORK_OPTION_LAYER_2, getConnectionType } from '../utils';
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
    let { network, tokenAddress } = args as unknown as {
      network: string;
      tokenAddress: string;
    };
    let { web3 } = await getEthereumClients(network, getConnectionType(args));
    let prepaidCard = await getSDK('PrepaidCard', web3);
    let weiAmount = await prepaidCard.gasFee(tokenAddress);
    console.log(`The gas fee for a new prepaid card in units of this token is ${fromWei(weiAmount)}`);
  },
} as CommandModule;
