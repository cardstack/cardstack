import { inject } from '@cardstack/di';
import { ScheduledPayment } from '@prisma/client';
import { isBefore, subDays } from 'date-fns';
import shortUUID from 'short-uuid';
import { nowUtc } from '../../utils/dates';
import config from 'config';
import { Wallet } from 'ethers';
import { JsonRpcProvider, gasPriceInToken } from '@cardstack/cardpay-sdk';

export let supportedChains = [
  {
    id: 1,
    name: 'ethereum',
    rpcUrl: config.get('web3.ethereum.rpcNodeHttpsUrl'),
  },
  {
    id: 5,
    name: 'goerli',
    rpcUrl: config.get('web3.ethereum.rpcNodeHttpsUrl'),
  },
  {
    id: 100,
    name: 'gnosis',
    rpcUrl: config.get('web3.gnosis.rpcNodeHttpsUrl'),
  },
  {
    id: 77,
    name: 'sokol',
    rpcUrl: config.get('web3.gnosis.rpcNodeHttpsUrl'),
  },
  {
    id: 137,
    name: 'polygon',
    rpcUrl: config.get('web3.polygon.rpcNodeHttpsUrl'),
  },
  {
    id: 80001,
    name: 'mumbai',
    rpcUrl: config.get('web3.polygon.rpcNodeHttpsUrl'),
  },
];

export default class ScheduledPaymentsExecutorService {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  scheduledPaymentFetcher = inject('scheduled-payment-fetcher', { as: 'scheduledPaymentFetcher' });
  cardpay = inject('cardpay');
  web3 = inject('web3-http', { as: 'web3' });
  workerClient = inject('worker-client', { as: 'workerClient' });

  async getCurrentGasPrice(provider: JsonRpcProvider, gasTokenAddress: string) {
    // Wrapped in a method so that can be mocked in the tests
    return gasPriceInToken(provider, gasTokenAddress);
  }

  async executePayment(scheduledPayment: ScheduledPayment) {
    let rpcUrl = supportedChains.find((chain) => chain.id === scheduledPayment.chainId)?.rpcUrl as string;
    let provider = new JsonRpcProvider(rpcUrl, scheduledPayment.chainId);
    let signer = new Wallet(config.get('hubPrivateKey'));
    let scheduledPaymentModule = await this.cardpay.getSDK('ScheduledPaymentModule', provider, signer);

    let prisma = await this.prismaManager.getClient();
    let paymentAttemptInProgress = await prisma.scheduledPaymentAttempt.findFirst({
      where: { scheduledPaymentId: scheduledPayment.id, status: 'inProgress' },
    });

    if (paymentAttemptInProgress) {
      throw new Error('Payment execution is already in progress');
    }

    if (scheduledPayment.recurringDayOfMonth) {
      let lastSuccessfulPaymentAttempt = await prisma.scheduledPaymentAttempt.findFirst({
        where: { scheduledPaymentId: scheduledPayment.id, status: 'succeeded' },
        orderBy: { endedAt: 'desc' },
      });

      let minDaysBetweenPayments = 28 - this.scheduledPaymentFetcher.validForDays * 2;
      if (
        lastSuccessfulPaymentAttempt &&
        !isBefore(lastSuccessfulPaymentAttempt.startedAt!, subDays(nowUtc(), minDaysBetweenPayments))
      ) {
        throw new Error(
          `Last payment was less than ${minDaysBetweenPayments} days ago. Looks like this scheduled payment is triggered too quickly.`
        );
      }
    }

    // Now that we know there is no payment attempt in progress, and that the payment is not too recent, we can create a new payment attempt
    let paymentAttempt = await prisma.scheduledPaymentAttempt.create({
      data: {
        id: shortUUID.uuid(),
        scheduledPaymentId: scheduledPayment.id,
        status: 'inProgress',
        startedAt: nowUtc(),
      },
    });

    let {
      moduleAddress,
      tokenAddress,
      amount,
      payeeAddress,
      feeFixedUsd,
      feePercentage,
      executionGasEstimation,
      maxGasPrice,
      gasTokenAddress,
      salt,
      payAt,
      recurringDayOfMonth,
      recurringUntil,
    } = scheduledPayment;

    let currentGasPrice = await this.getCurrentGasPrice(provider, gasTokenAddress);

    return new Promise<void>((resolve, reject) => {
      scheduledPaymentModule
        .executeScheduledPayment(
          moduleAddress,
          tokenAddress,
          amount.toString(),
          payeeAddress,
          Number(feeFixedUsd),
          Number(feePercentage),
          Number(executionGasEstimation),
          String(maxGasPrice),
          gasTokenAddress,
          salt,
          String(currentGasPrice), // Contract will revert if this is larger than maxGasPrice
          payAt!.getTime() / 1000, // getTime returns milliseconds, but we want seconds, thus divide by 1000
          recurringDayOfMonth,
          recurringUntil ? recurringUntil.getTime() / 1000 : null,
          {
            onTxnHash: async (txnHash: string) => {
              await prisma.scheduledPaymentAttempt.update({
                data: {
                  transactionHash: txnHash,
                },
                where: {
                  id: paymentAttempt.id,
                },
              });

              await this.workerClient.addJob('scheduled-payment-on-chain-execution-waiter', {
                scheduledPaymentAttemptId: paymentAttempt.id,
              });

              resolve();
            },
          }
        )
        .catch(async (error) => {
          await prisma.scheduledPaymentAttempt.update({
            where: { id: paymentAttempt.id },
            data: {
              status: 'failed',
              endedAt: nowUtc(),
              failureReason: error.message,
            },
          });
          reject(error);
        });
    });
  }
}
