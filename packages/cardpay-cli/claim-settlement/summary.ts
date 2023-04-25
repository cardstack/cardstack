import { Arguments, Argv, CommandModule } from 'yargs';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'summary <moduleAddress>',
  describe: 'Get summary of a module',
  builder(yargs: Argv) {
    return yargs
      .positional('moduleAddress', {
        type: 'string',
        description: 'Module address enabled on safe',
      })
      .positional('safeAddress', {
        type: 'string',
        description: 'The address of the safe whose enables the scheduled payment module',
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let { network, moduleAddress } = args as unknown as {
      network: string;
      moduleAddress: string;
    };
    let { ethersProvider, signer } = await getEthereumClients(network, getConnectionType(args));
    let claimSettlementModule = await getSDK('ClaimSettlementModule', ethersProvider, signer);
    let { owner, target, avatar } = await claimSettlementModule.getDetails(moduleAddress);
    let did = await claimSettlementModule.getDid(moduleAddress);
    let validators = await claimSettlementModule.getValidators(moduleAddress);

    console.log(
      `
      Claim Settlement 
      ================

      Module Address: ${moduleAddress}

      Module Details: 
        Owner: ${owner}
        Target: ${target}
        Avatar: ${avatar}


      Validators: 
      ${validators}

      Did: 
      ${did}
        `
    );
  },
} as CommandModule;
