import { Arguments, Argv, CommandModule } from 'yargs';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'set-did <moduleAddress> <safeAddress> <did> [gasTokenAddress]',
  describe: 'Set did configuration on module',
  builder(yargs: Argv) {
    return yargs
      .positional('moduleAddress', {
        type: 'string',
        description: 'Module address enabled on safe',
      })
      .positional('safeAddress', {
        type: 'string',
        description: 'The address receiving assets from claim',
      })
      .positional('did', {
        type: 'string',
        description: 'did identifier',
      })
      .option('gasTokenAddress', {
        type: 'string',
        description: 'The address of gas token',
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let { network, safeAddress, moduleAddress, did, gasTokenAddress } = args as unknown as {
      network: string;
      safeAddress: string;
      moduleAddress: string;
      did: string;
      gasTokenAddress: string;
    };
    let { ethersProvider, signer } = await getEthereumClients(network, getConnectionType(args));
    let claimSettlementModule = await getSDK('ClaimSettlementModule', ethersProvider, signer);
    let blockExplorer = await getConstant('blockExplorer', ethersProvider);
    let onTxnHash = (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}`);
    await claimSettlementModule.setDid(moduleAddress, safeAddress, did, gasTokenAddress, { onTxnHash });
  },
} as CommandModule;
