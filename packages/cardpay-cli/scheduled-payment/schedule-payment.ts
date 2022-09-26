import { Argv } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { Arguments } from 'yargs';

export default {
  command: 'schedule-payment <safeAddress> <safeModuleAddress> <gasTokenAddress> <spHash>',
  describe: ' ',
  builder(yargs: Argv) {
    return yargs
      .positional('safeAddress', {
        type: 'string',
        description: 'The address of the safe that will fund the scheduled payment',
      })
      .positional('safeModuleAddress', {
        type: 'string',
        description: 'The address of the scheduled payment safe module',
      })
      .positional('gasTokenAddress', {
        type: 'string',
        description: 'The address of the gas token',
      })
      .positional('spHash', {
        type: 'string',
        description: 'Keccak hash of the scheduled payment params',
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let { network, safeAddress, gasTokenAddress, safeModuleAddress, spHash } = args as unknown as {
      network: string;
      safeAddress: string;
      safeModuleAddress: string;
      gasTokenAddress: string;
      spHash: string;
    };

    console.log(`Adding scheduled payment with scheduled payment hash: ${spHash}...`);

    let { ethersProvider, signer } = await getEthereumClients(network, getConnectionType(args));
    let scheduledPaymentModule = await getSDK('ScheduledPaymentModule', ethersProvider, signer);
    let blockExplorer = await getConstant('blockExplorer', ethersProvider);

    console.log(`Waiting for the transaction to be mined...`);
    await scheduledPaymentModule.schedulePayment(safeAddress, safeModuleAddress, gasTokenAddress, spHash, null, {
      onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}`),
    });

    console.log(`Done`);
  },
};
