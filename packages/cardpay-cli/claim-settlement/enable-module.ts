import { Argv } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { Arguments, CommandModule } from 'yargs';

export default {
  command: 'enable-module <safeAddress> <gasTokenAddress>',
  describe: 'Enable claim settlement module on the safe',
  builder(yargs: Argv) {
    return yargs
      .positional('safeAddress', {
        type: 'string',
        description: 'The address of the safe whose enables the scheduled payment module',
      })
      .positional('gasTokenAddress', {
        type: 'string',
        description: 'The token address (defaults to Goerli DAI)',
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let { network, safeAddress, gasTokenAddress } = args as unknown as {
      network: string;
      safeAddress: string;
      gasTokenAddress: string;
    };
    let { ethersProvider, signer } = await getEthereumClients(network, getConnectionType(args));
    let claimSettlementModule = await getSDK('ClaimSettlementModule', ethersProvider, signer);
    let blockExplorer = await getConstant('blockExplorer', ethersProvider);

    console.log(`Enabling claim settlement module on safe ${safeAddress}`);
    let onTxnHash = (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}`);
    let { moduleAddress, metaGuardAddress } = await claimSettlementModule.enableModuleAndGuard(
      safeAddress,
      gasTokenAddress,
      {
        onTxnHash,
      }
    );
    console.log(`Claim Settlement module deployed to: ${moduleAddress}`);
    console.log(`Meta guard deployed to: ${metaGuardAddress}`);
    console.log(`Done. The module and guard have now been enabled on safe ${safeAddress}`);
  },
} as CommandModule;
