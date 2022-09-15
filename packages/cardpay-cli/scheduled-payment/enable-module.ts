import { Argv } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { Arguments, CommandModule } from 'yargs';

export default {
  command: 'enable-module <safeAddress> <gasTokenAddress>',
  describe: 'Enable scheduled payment module on the safe',
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
    let { web3, signer } = await getEthereumClients(network, getConnectionType(args));
    let scheduledPaymentModule = await getSDK('ScheduledPaymentModule', web3, signer);
    let blockExplorer = await getConstant('blockExplorer', web3);

    console.log(`Enabling scheduled payment module on safe ${safeAddress}`);
    let onTxnHash = (txnHash: string) =>
      console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`);
    let { scheduledPaymentModuleAddress, metaGuardAddress } = await scheduledPaymentModule.enableModuleAndGuard(
      safeAddress,
      gasTokenAddress,
      { onTxnHash }
    );
    console.log(`Scheduled payment module deployed to: ${scheduledPaymentModuleAddress}`);
    console.log(`Meta guard deployed to: ${metaGuardAddress}`);
    console.log(`Done. The module and guard have now been enabled on safe ${safeAddress}`);
  },
} as CommandModule;
