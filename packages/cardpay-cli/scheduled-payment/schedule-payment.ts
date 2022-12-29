import { Argv } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { Arguments } from 'yargs';

export default {
  command:
    'schedule-payment <safeAddress> <moduleAddress> <tokenAddress> <amount> <payeeAddress> <executionGas> <maxGasPrice> <gasTokenAddress> <salt>',
  describe:
    "Schedules a one-time or a recurring payment. This creates a record in the crank (hub) and stores the scheduled payment hash in the safe's scheduled payment module contract. The crank is responsible for executing the payment at the scheduled time.",
  builder(yargs: Argv) {
    return yargs
      .positional('safeAddress', {
        type: 'string',
        description: 'The address of the safe that will fund the scheduled payment',
      })
      .positional('moduleAddress', {
        type: 'string',
        description: 'The address of the scheduled payment safe module',
      })
      .positional('tokenAddress', {
        type: 'string',
        description: 'The address of the token to be transferred',
      })
      .positional('amount', {
        type: 'string',
        description: 'The amount of tokens to be transferred',
      })
      .positional('payeeAddress', {
        type: 'string',
        description: 'The address of the payee (recipient)',
      })
      .positional('executionGas', {
        type: 'number',
        description: 'The gas limit to execute scheduled payment',
      })
      .positional('maxGasPrice', {
        type: 'string',
        description: 'Maximum gas price (in the smallest units of gas token)',
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
        description:
          'Unix UTC time in seconds that represents the point in time when the payment should be executed. Used for one-time scheduled payments. Should not be provided when recurringDayOfMonth and recurringUntil are set',
      })
      .option('recurringDayOfMonth', {
        type: 'number',
        description:
          'Day of the month on which the payment will be made recurringly (range: 1-31). Used for recurring scheduled payments. In case the month has less than days than the value provided, the payment will me made on the last day of the month. Should not be provided when payAt is set.',
      })
      .option('recurringUntil', {
        type: 'number',
        description:
          'Unix UTC time in seconds that represents the point in time when the recurring payment should be stopped. Used for recurring scheduled payments. Should not be provided when payAt is set',
      })
      .option('network', NETWORK_OPTION_ANY);
  },
  async handler(args: Arguments) {
    let {
      network,
      safeAddress,
      moduleAddress,
      tokenAddress,
      amount,
      payeeAddress,
      executionGas,
      maxGasPrice,
      gasTokenAddress,
      salt,
      payAt,
      recurringDayOfMonth,
      recurringUntil,
    } = args as unknown as {
      network: string;
      safeAddress: string;
      moduleAddress: string;
      tokenAddress: string;
      amount: string;
      payeeAddress: string;
      executionGas: number;
      maxGasPrice: string;
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

    console.log(`Creating a scheduled payment...`);
    await scheduledPaymentModule.schedulePayment(
      safeAddress,
      moduleAddress,
      tokenAddress,
      amount,
      payeeAddress,
      executionGas,
      maxGasPrice,
      gasTokenAddress,
      salt,
      payAt,
      recurringDayOfMonth,
      recurringUntil,
      {
        listener: {
          onScheduledPaymentIdReady(scheduledPaymentId) {
            console.log(`Scheduled payment created in the crank: ${scheduledPaymentId}.`);
            console.log('Waiting for the transaction to be mined...');
          },
        },
      }
    );

    console.log(`Scheduled payment added in both crank and on chain successfully.`);
  },
};
