import { Arguments, Argv, CommandModule } from 'yargs';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'execute <moduleAddress> <safeAddress> <payeeAddress>',
  describe: 'Execute a claim settlement',
  builder(yargs: Argv) {
    return yargs
      .positional('moduleAddress', {
        type: 'string',
        description: 'Module address enabled on safe',
      })
      .positional('safeAddress', {
        type: 'string',
        description: 'The address of the safe whose enables the claim settlement module',
      })
      .positional('payeeAddress', {
        type: 'string',
        description: 'The address receiving assets from claim',
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let { network, moduleAddress, safeAddress } = args as unknown as {
      network: string;
      moduleAddress: string;
      safeAddress: string;
      payeeAddress: string;
    };
    let { ethersProvider, signer } = await getEthereumClients(network, getConnectionType(args));
    let claimSettlementModule = await getSDK('ClaimSettlementModule', ethersProvider, signer);
    let blockExplorer = await getConstant('blockExplorer', ethersProvider);
    let onTxnHash = (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}`);
    await claimSettlementModule.executeEOA(moduleAddress, safeAddress, { onTxnHash });
  },
} as CommandModule;
