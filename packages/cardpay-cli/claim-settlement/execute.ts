import { Arguments, Argv, CommandModule } from 'yargs';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'execute <moduleAddress> [payeeSafeAddress]',
  describe: 'Execute a claim settlement',
  builder(yargs: Argv) {
    return yargs
      .positional('moduleAddress', {
        type: 'string',
        description: 'Module address enabled on safe',
      })
      .option('payeeSafeAddress', {
        type: 'string',
        description: 'The address receiving assets from claim',
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let { network, moduleAddress, payeeSafeAddress } = args as unknown as {
      network: string;
      moduleAddress: string;
      payeeSafeAddress: string;
    };
    let { ethersProvider, signer } = await getEthereumClients(network, getConnectionType(args));
    let claimSettlementModule = await getSDK('ClaimSettlementModule', ethersProvider, signer);
    let blockExplorer = await getConstant('blockExplorer', ethersProvider);
    let onTxnHash = (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}`);
    if (payeeSafeAddress) {
      await claimSettlementModule.executeSafe(moduleAddress, payeeSafeAddress, { onTxnHash });
    } else {
      await claimSettlementModule.executeEOA(moduleAddress, { onTxnHash });
    }
  },
} as CommandModule;
