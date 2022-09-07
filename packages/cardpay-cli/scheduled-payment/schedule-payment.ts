import { Argv } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { Arguments } from 'yargs';

export default {
  command: 'schedule-payment <senderSafeAddress> <safeModuleAddress> <tokenAddress> <spHash>',
  describe: ' ',
  builder(yargs: Argv) {
    return yargs
      .positional('senderSafeAddress', {
        type: 'string',
        description: 'The address of the safe that will fund the scheduled payment',
      })
      .positional('safeModuleAddress', {
        type: 'string',
        description: 'The address of the scheduled payment safe module',
      })
      .positional('tokenAddress', {
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
    let { network, senderSafeAddress, tokenAddress, safeModuleAddress, spHash } = args as unknown as {
      network: string;
      senderSafeAddress: string;
      safeModuleAddress: string;
      tokenAddress: string;
      spHash: string;
    };

    console.log(`Adding scheduled payment with scheduled payment hash: ${spHash}...`);

    let { web3, signer } = await getEthereumClients(network, getConnectionType(args));
    let scheduledPaymentModule = await getSDK('ScheduledPaymentModule', web3, signer);
    let blockExplorer = await getConstant('blockExplorer', web3);

    console.log(`Waiting for the transaction to be mined...`);
    await scheduledPaymentModule.schedulePayment(senderSafeAddress, safeModuleAddress, tokenAddress, spHash, null, {
      onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}`),
    });

    console.log(`Done`);
  },
};
