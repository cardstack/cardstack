import { Arguments, Argv, CommandModule } from 'yargs';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'get-configuration <moduleAddress>',
  describe: 'Get JSON configuration from did set on module',
  builder(yargs: Argv) {
    return yargs
      .positional('moduleAddress', {
        type: 'string',
        description: 'Module address enabled on safe',
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let { network, moduleAddress } = args as unknown as {
      network: string;
      moduleAddress: string;
      gasTokenAddress: string;
    };
    let { ethersProvider, signer } = await getEthereumClients(network, getConnectionType(args));
    let claimSettlementModule = await getSDK('ClaimSettlementModule', ethersProvider, signer);
    let configuration = await claimSettlementModule.getConfiguration(moduleAddress);
    console.log(JSON.stringify(configuration, undefined, 2));
  },
} as CommandModule;
