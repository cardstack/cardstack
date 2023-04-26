import { Arguments, Argv, CommandModule } from 'yargs';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'is-registered <address>',
  describe: 'Get JSON configuration from did set on module',
  builder(yargs: Argv) {
    return yargs
      .positional('address', {
        type: 'string',
        description: 'address',
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let { network, address } = args as unknown as {
      network: string;
      address: string;
    };
    let { ethersProvider, signer } = await getEthereumClients(network, getConnectionType(args));
    let claimSettlementModule = await getSDK('ClaimSettlementModule', ethersProvider, signer);
    let isRegistered = await claimSettlementModule.isRegistered(address);
    console.log(isRegistered);
  },
} as CommandModule;
