import { Argv } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { Arguments, CommandModule } from 'yargs';

export default {
  command: 'cancel <safeAddress> <moduleAddress> <gasTokenAddress> <spHash>',
  describe: 'Cancel a scheduled payment',
  builder(yargs: Argv) {
    return yargs
      .positional('safeAddress', {
        type: 'string',
        description: 'The address of the safe that will fund the scheduled payment',
      })
      .positional('moduleAddress', {
        type: 'string',
        description: 'The address of scheduled payment module',
      })
      .positional('gasTokenAddress', {
        type: 'string',
        description: 'The address of gas token',
      })
      .positional('spHash', {
        type: 'string',
        description: 'Keccak hash of the scheduled payment params',
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let { network, safeAddress, moduleAddress, gasTokenAddress, spHash } = args as unknown as {
      network: string;
      safeAddress: string;
      moduleAddress: string;
      gasTokenAddress: string;
      spHash: string;
    };
    let { ethersProvider, signer } = await getEthereumClients(network, getConnectionType(args));
    let scheduledPaymentModule = await getSDK('ScheduledPaymentModule', ethersProvider, signer);
    let blockExplorer = await getConstant('blockExplorer', ethersProvider);

    console.log(`Cancel scheduled payment with spHash: ${spHash} ...`);
    let onTxnHash = (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}`);
    await scheduledPaymentModule.cancelScheduledPayment(safeAddress, moduleAddress, spHash, gasTokenAddress, {
      onTxnHash,
    });

    console.log(`Scheduled payment canceled successfuly (spHash: ${spHash})`);
  },
} as CommandModule;
