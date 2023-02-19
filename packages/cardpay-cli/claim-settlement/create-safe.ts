import { Argv } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { Arguments, CommandModule } from 'yargs';

export default {
  command: 'create-safe',
  describe: 'Create a new safe with claim-settlement module and meta guard installed',
  builder(yargs: Argv) {
    return yargs
      .option('txnHash', {
        type: 'string',
        description: 'The hash of multi send safe creation transaction',
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let { network, txnHash } = args as unknown as {
      network: string;
      txnHash: string;
    };
    let { ethersProvider, signer } = await getEthereumClients(network, getConnectionType(args));
    let claimSettlementModule = await getSDK('ClaimSettlementModule', ethersProvider, signer);
    let blockExplorer = await getConstant('blockExplorer', ethersProvider);

    console.log(`Create a new safe and install Claim Settlement module and meta guard...`);
    let onTxnHash = (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}`);
    let { safeAddress, moduleAddress, metaGuardAddress } = await claimSettlementModule.createSafeWithModuleAndGuard(
      txnHash,
      { onTxnHash }
    );
    if (!safeAddress) {
      console.log(`Failed to deploy new safe`);
    } else {
      console.log(`Safe deployed to: ${safeAddress}`);
      console.log(`Scheduled payment module deployed to: ${moduleAddress}`);
      console.log(`Meta guard deployed to: ${metaGuardAddress}`);
    }
  },
} as CommandModule;
