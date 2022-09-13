import { Argv } from 'yargs';
import { getConstant, getSDK } from '@cardstack/cardpay-sdk';
import { getEthereumClients, getConnectionType, NETWORK_OPTION_ANY } from '../utils';
import { Arguments, CommandModule } from 'yargs';

export default {
  command:
    'cancel <safeAddress> <moduleAddress> <tokenAddress> <amount> <payeeAddress> <fixedUSDFee> <percentageFee> <executionGas> <maxGasPrice> <gasTokenAddress> <salt> <payAt>',
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
      .positional('executionGas', {
        type: 'string',
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
      .positional('payAt', {
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
      safeAddress,
      moduleAddress,
      tokenAddress,
      amount,
      payeeAddress,
      fixedUSDFee,
      percentageFee,
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
      fixedUSDFee: number;
      percentageFee: number;
      executionGas: number;
      maxGasPrice: string;
      gasTokenAddress: string;
      salt: string;
      payAt: number;
      recurringDayOfMonth: number;
      recurringUntil: number;
    };
    let { web3, signer } = await getEthereumClients(network, getConnectionType(args));
    let scheduledPaymentModule = await getSDK('ScheduledPaymentModule', web3, signer);
    let blockExplorer = await getConstant('blockExplorer', web3);
    let spHash = await scheduledPaymentModule.createSpHash(
      moduleAddress,
      tokenAddress,
      amount,
      payeeAddress,
      {
        fixedUSD: fixedUSDFee,
        percentage: percentageFee,
      },
      executionGas,
      maxGasPrice,
      gasTokenAddress,
      salt,
      recurringDayOfMonth ? recurringDayOfMonth : payAt,
      recurringUntil
    );

    console.log(`Cancel scheduled payment with spHash: ${spHash} ...`);
    let onTxnHash = (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}`);
    await scheduledPaymentModule.cancelScheduledPayment(safeAddress, moduleAddress, spHash, gasTokenAddress, {
      onTxnHash,
    });

    console.log(`Scheduled payment canceled successfuly (spHash: ${spHash})`);
  },
} as CommandModule;
