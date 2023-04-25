import { Arguments, Argv, CommandModule } from 'yargs';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';

export default {
  command: 'register-account <safeAddress> [recipient] [gasTokenAddress]',
  describe: 'Register account to mint accountRegistration nft ',
  builder(yargs: Argv) {
    return yargs
      .positional('safeAddress', {
        type: 'string',
        description: 'The address receiving assets from claim',
      })
      .option('recipeint', {
        type: 'string',
        description: 'The address receiving nft',
      })
      .option('gasTokenAddress', {
        type: 'string',
        description: 'The address of gas token',
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let { network, safeAddress, recipient, gasTokenAddress } = args as unknown as {
      network: string;
      safeAddress: string;
      recipient: string;
      gasTokenAddress: string;
    };
    let { ethersProvider, signer } = await getEthereumClients(network, getConnectionType(args));
    let claimSettlementModule = await getSDK('ClaimSettlementModule', ethersProvider, signer);
    let blockExplorer = await getConstant('blockExplorer', ethersProvider);
    let onTxnHash = (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}`);
    await claimSettlementModule.registerAccount(safeAddress, recipient, gasTokenAddress, { onTxnHash });
  },
} as CommandModule;
