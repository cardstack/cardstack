import { Arguments, Argv, CommandModule } from 'yargs';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'is-module-enabled <safeAddress> <moduleAddress>',
  describe: 'Get summary of a module',
  builder(yargs: Argv) {
    return yargs
      .positional('safeAddress', {
        type: 'string',
        description: 'The address of the safe whose enables the claim settlement module',
      })
      .positional('moduleAddress', {
        type: 'string',
        description: 'Module address enabled on safe',
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let { network, moduleAddress, safeAddress } = args as unknown as {
      network: string;
      safeAddress: string;
      moduleAddress: string;
    };
    let { ethersProvider, signer } = await getEthereumClients(network, getConnectionType(args));
    let claimSettlementModule = await getSDK('ClaimSettlementModule', ethersProvider, signer);
    let isModuleEnabled = await claimSettlementModule.isModuleEnabled(safeAddress, moduleAddress);
    console.log(isModuleEnabled);
  },
} as CommandModule;
