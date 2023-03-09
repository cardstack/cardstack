import { Argv } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { Arguments, CommandModule } from 'yargs';

export default {
  command: 'estimate-execution-with-no-amount <moduleAddress> <tokenAddress> <payeeAddress> <gasTokenAddress> <salt>',
  describe: 'Estimate gas for scheduled payment execution',
  builder(yargs: Argv) {
    return yargs
      .positional('moduleAddress', {
        type: 'string',
        description: 'The address of scheduled payment module',
      })
      .positional('tokenAddress', {
        type: 'string',
        description: 'The address of the token being transferred',
      })
      .positional('payeeAddress', {
        type: 'string',
        description: 'The address of the payee of scheduled payment',
      })
      .positional('fixedUSDFee', {
        type: 'number',
        description: 'Fixed USD fee (e.g. 0.25)',
      })
      .positional('percentageFee', {
        type: 'number',
        description: 'Percentage fee (e.g. 5%, 0.05)',
      })
      .positional('gasTokenAddress', {
        type: 'string',
        description: 'The address of the gas token',
      })
      .positional('salt', {
        type: 'string',
        description: 'Arbitrary string to make SP unique',
      })
      .option('payAt', {
        type: 'number',
        description: 'Time to execute scheduled payments (in seconds)',
      })
      .option('recurringDayOfMonth', {
        type: 'number',
        description: 'Days of the month in the range of 1-28 to make recurring payments',
      })
      .option('recurringUntil', {
        type: 'number',
        description: 'End date of recurring payment',
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let {
      network,
      moduleAddress,
      tokenAddress,
      payeeAddress,
      gasTokenAddress,
      salt,
      payAt,
      recurringDayOfMonth,
      recurringUntil,
    } = args as unknown as {
      network: string;
      moduleAddress: string;
      tokenAddress: string;
      payeeAddress: string;
      gasTokenAddress: string;
      salt: string;
      payAt?: number | null;
      recurringDayOfMonth?: number | null;
      recurringUntil?: number | null;
    };

    // Empty strings are converted to 0 by yargs. We want to convert them to null
    if (payAt === 0) payAt = null;
    if (recurringDayOfMonth === 0) recurringDayOfMonth = null;
    if (recurringUntil === 0) recurringUntil = null;

    let { ethersProvider, signer } = await getEthereumClients(network, getConnectionType(args));
    let scheduledPaymentModule = await getSDK('ScheduledPaymentModule', ethersProvider, signer);

    console.log(`Estimate scheduled payment execution gas ...`);

    let requiredGas = await scheduledPaymentModule.estimateExecutionGasWithNoAmount(
      moduleAddress,
      tokenAddress,
      payeeAddress,
      gasTokenAddress,
      salt,
      payAt,
      recurringDayOfMonth,
      recurringUntil
    );

    console.log(`Required execution gas: ${requiredGas}`);
  },
} as CommandModule;
