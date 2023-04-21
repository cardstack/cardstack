import * as Sentry from '@sentry/node';
import { inject } from '@cardstack/di';
import { ScheduledPayment } from '@prisma/client';
import { isBefore, subDays } from 'date-fns';
import shortUUID from 'short-uuid';
import config from 'config';
import { Wallet, BigNumber } from 'ethers';
import {
  JsonRpcProvider,
  getNativeToTokenRate,
  getConstant,
  ScheduledPaymentModule,
  applyRateToAmount,
  getUsdcToTokenRate,
} from '@cardstack/cardpay-sdk';
import BN from 'bn.js';

export default class ScheduledPaymentsExecutorService {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  scheduledPaymentFetcher = inject('scheduled-payment-fetcher', { as: 'scheduledPaymentFetcher' });
  cardpay = inject('cardpay');
  workerClient = inject('worker-client', { as: 'workerClient' });
  crankNonceLock = inject('crank-nonce-lock', { as: 'crankNonceLock' });
  ethersProvider = inject('ethers-provider', { as: 'ethersProvider' });
  clock = inject('clock', { as: 'clock' });
  gasStation = inject('gas-station-service', { as: 'gasStation' });

  async fetchTokenToUsdcRate(provider: JsonRpcProvider, token: string) {
    let usdcToTokenRate = await getUsdcToTokenRate(provider, token);
    return 1 / usdcToTokenRate.rate.toUnsafeFloat();
  }

  async getCurrentGasPrice(provider: JsonRpcProvider, gasTokenAddress: string) {
    let gasPrices = await this.gasStation.getGasPriceByChainId(provider.network.chainId);
    let nativeToTokenRate = await getNativeToTokenRate(provider, gasTokenAddress);
    let fastGasPriceInGasToken = applyRateToAmount(nativeToTokenRate, BigNumber.from(gasPrices.fast));

    // Use fast gas price for better chances of getting the transaction accepted
    return {
      gasPrice: gasPrices.fast,
      gasPriceInGasToken: fastGasPriceInGasToken.toString(),
    };
  }

  async executeScheduledPayments() {
    const schedulerNetworks: string[] = config.get('web3.schedulerNetworks');
    for (const network of schedulerNetworks) {
      const chainId = await getConstant('chainId', network);
      let provider = this.ethersProvider.getInstance(chainId);
      let signer = new Wallet(config.get('hubPrivateKey'));
      let scheduledPaymentModule = await this.cardpay.getSDK('ScheduledPaymentModule', provider, signer);
      const validForDays = await scheduledPaymentModule.getValidForDays();
      let scheduledPayments = await this.scheduledPaymentFetcher.fetchScheduledPayments(chainId);

      // Currently we do one by one, but we can do in parallel when we'll have a lot of scheduled payments
      for (let scheduledPayment of scheduledPayments) {
        try {
          // If this succeeds, it means that the scheduled payment transaction was submitted
          // and the ScheduledPaymentOnChainExecutionWaiter will wait for it to be mined in the background
          await this.executePayment(scheduledPayment, validForDays, provider, scheduledPaymentModule);
        } catch (e) {
          Sentry.captureException(e);
          console.error(e);
          // Don't throw, continue to the next scheduled payment
        }
      }
    }
  }

  async executePayment(
    scheduledPayment: ScheduledPayment,
    validForDays: number,
    provider: JsonRpcProvider,
    scheduledPaymentModule: ScheduledPaymentModule
  ) {
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

      // minDaysBetweenPayments is a very rough validation to prevent accidental duplicated execution of recurring payments
      // 28 days is the max number of days in a month, and validForDays is the retry period for failed payments.
      // For more accurate validation we rely on the scheduled payment module contract, which will revert with
      // InvalidPeriod if the payment is executed at the wrong time
      let minDaysBetweenPayments = 28 - validForDays;
      if (
        lastSuccessfulPaymentAttempt &&
        !isBefore(lastSuccessfulPaymentAttempt.startedAt!, subDays(this.clock.utcNow(), minDaysBetweenPayments))
      ) {
        throw new Error(
          `Last payment was less than ${minDaysBetweenPayments} days ago. Looks like this scheduled payment is triggered too quickly.`
        );
      }
    }

    let currentGasPrice = await this.getCurrentGasPrice(provider, scheduledPayment.gasTokenAddress);

    if (!BigNumber.from(currentGasPrice.gasPriceInGasToken).gt(BigNumber.from('0'))) {
      // Otherwise the crank will execute transactions for free (0 fee will be reimbursed)
      throw new Error('Gas price in gas token should be greater than 0');
    }

    // Now that we know there is no payment attempt in progress, and that the payment is not too recent, we can create a new payment attempt
    let paymentAttempt = await prisma.scheduledPaymentAttempt.create({
      data: {
        id: shortUUID.uuid(),
        scheduledPaymentId: scheduledPayment.id,
        status: 'inProgress',
        startedAt: this.clock.utcNow(),
        executionGasPrice: currentGasPrice.gasPriceInGasToken,
        tokenToUsdcRate: await this.fetchTokenToUsdcRate(provider, scheduledPayment.tokenAddress),
      },
    });

    let scheduledPaymentAttemptsInLastPaymentCycleCount = (
      await prisma.scheduledPaymentAttempt.findMany({
        where: {
          startedAt: {
            gte: scheduledPayment.payAt!,
          },
          scheduledPaymentId: scheduledPayment.id,
        },
      })
    ).length;

    scheduledPayment = await prisma.scheduledPayment.update({
      where: { id: scheduledPayment.id },
      data: {
        lastScheduledPaymentAttemptId: paymentAttempt.id,
        scheduledPaymentAttemptsInLastPaymentCycleCount,
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

    try {
      let params = {
        moduleAddress,
        tokenAddress,
        amount: amount.toString(),
        payeeAddress,
        feeFixedUsd: Number(feeFixedUsd),
        feePercentage: Number(feePercentage),
        executionGasEstimation: Number(executionGasEstimation),
        maxGasPrice: String(maxGasPrice),
        gasTokenAddress,
        salt,
        currentGasPrice: String(currentGasPrice.gasPriceInGasToken), // Contract will revert if this is larger than maxGasPrice
        payAt: payAt!.getTime() / 1000, // getTime returns milliseconds, but we want seconds, thus divide by 1000
        recurringDayOfMonth: recurringDayOfMonth,
        recurringUntil: recurringUntil ? recurringUntil.getTime() / 1000 : null,
      };

      Sentry.captureMessage(`Executing a payment with params: ${JSON.stringify(params)}`); // Useful for debugging purposes (for example, to see which params were used to calculate the spHash)

      let executeScheduledPayment = (nonce: BN) => {
        return new Promise<string>((resolve, reject) => {
          scheduledPaymentModule
            .executeScheduledPayment(
              params.moduleAddress,
              params.tokenAddress,
              params.amount,
              params.payeeAddress,
              params.feeFixedUsd,
              params.feePercentage,
              params.executionGasEstimation,
              params.maxGasPrice,
              params.gasTokenAddress,
              params.salt,
              params.currentGasPrice,
              params.recurringDayOfMonth ? null : params.payAt, // SDK will throw an error if both payAt and recurringDayOfMonth are set
              params.recurringDayOfMonth,
              params.recurringUntil,
              {
                onTxnHash: async (txnHash: string) => resolve(txnHash),
                nonce: nonce,
                gasPrice: new BN(currentGasPrice.gasPrice),
                gasLimit: new BN(params.executionGasEstimation),
              }
            )
            .catch(async (error) => {
              reject(error);
            });
        });
      };

      let txnHash = await this.crankNonceLock.withNonce(scheduledPayment.chainId, executeScheduledPayment);
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
    } catch (error: any) {
      await prisma.scheduledPaymentAttempt.update({
        where: { id: paymentAttempt.id },
        data: {
          status: 'failed',
          endedAt: this.clock.utcNow(),
          failureReason: error.message,
        },
      });

      await prisma.scheduledPayment.update({
        where: { id: scheduledPayment.id },
        data: {
          nextRetryAttemptAt: this.scheduledPaymentFetcher.calculateNextRetryAttemptDate(scheduledPayment),
        },
      });

      throw error;
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'scheduled-payment-executor': ScheduledPaymentsExecutorService;
  }
}
