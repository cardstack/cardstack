import { Argv } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import { getWeb3, NETWORK_OPTION_LAYER_2 } from '../utils';
import { Arguments, CommandModule } from 'yargs';

export default {
  command: 'auth <hubRootUrl>',
  describe: 'Get an authentication token that can be used to make API requests to a Cardstack Hub server',
  builder(yargs: Argv) {
    return yargs
      .positional('hubRootUrl', {
        type: 'string',
        description: 'The URL of the hub server to authenticate with',
      })
      .option('network', NETWORK_OPTION_LAYER_2);
  },
  async handler(args: Arguments) {
    let { hubRootUrl, network, mnemonic } = args as unknown as {
      hubRootUrl: string;
      network: string;
      mnemonic: string;
    };
    let web3 = await getWeb3(network, mnemonic);
    let authToken = await (await getSDK('HubAuth', web3, hubRootUrl)).authenticate();
    console.log(`Authentication token for ${hubRootUrl}: ${authToken}`);
  },
} as CommandModule;
