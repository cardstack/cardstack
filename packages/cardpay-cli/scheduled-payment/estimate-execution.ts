import { Argv } from 'yargs';
import { getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { Arguments, CommandModule } from 'yargs';

export default {
  command:
    'estimate-execution <moduleAddress> <tokenAddress> <amount> <payeeAddress> <fixedUSDFee> <percentageFee> <maxGasPrice> <gasTokenAddress> <salt> <payAt> <gasPrice>',
  describe: 'Enable scheduled payment module on the safe',
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
      .positional('amount', {
        type: 'string',
        description: 'Amount of tokens you would like transferred (in the smallest units of token)',
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
      .positional('percentageFee', {
        type: 'number',
        description: 'Percentage fee (e.g. 5%, 0.05)',
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
      .positional('payAt', {
        type: 'number',
        description: 'Time to execute scheduled payments (in seconds)',
      })
      .positional('gasPrice', {
        type: 'string',
        description: 'Gas price (in the smallest units of gas token)',
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
      amount,
      payeeAddress,
      fixedUSDFee,
      percentageFee,
      maxGasPrice,
      gasTokenAddress,
      salt,
      payAt,
      gasPrice,
      recurringDayOfMonth,
      recurringUntil,
    } = args as unknown as {
      network: string;
      moduleAddress: string;
      tokenAddress: string;
      amount: string;
      payeeAddress: string;
      fixedUSDFee: number;
      percentageFee: number;
      maxGasPrice: string;
      gasTokenAddress: string;
      salt: string;
      payAt: number;
      gasPrice: string;
      recurringDayOfMonth: number;
      recurringUntil: number;
    };
    let { web3, signer } = await getEthereumClients(network, getConnectionType(args));
    let scheduledPaymentModule = await getSDK('ScheduledPaymentModule', web3, signer);

    console.log(`Estimate scheduled payment execution gas ...`);

    let requiredGas = await scheduledPaymentModule.estimateExecutionGas(
      moduleAddress,
      tokenAddress,
      amount,
      payeeAddress,
      {
        fixedUSD: fixedUSDFee,
        percentage: percentageFee,
      },
      maxGasPrice,
      gasTokenAddress,
      salt,
      recurringDayOfMonth ? recurringDayOfMonth : payAt,
      gasPrice,
      recurringUntil
    );

    console.log(`Required execution gas: ${requiredGas}`);
  },
} as CommandModule;
