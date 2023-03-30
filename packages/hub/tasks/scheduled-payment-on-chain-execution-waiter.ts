import { inject } from '@cardstack/di';
import { isBefore, subDays } from 'date-fns';

import { nowUtc } from '../utils/dates';
import { calculateNextPayAt } from '../utils/scheduled-payments';

export default class ScheduledPaymentOnChainExecutionWaiter {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  cardpay = inject('cardpay');
  workerClient = inject('worker-client', { as: 'workerClient' });
  ethersProvider = inject('ethers-provider', { as: 'ethersProvider' });
  scheduledPaymentFetcher = inject('scheduled-payment-fetcher', { as: 'scheduledPaymentFetcher' });

  async perform(payload: { scheduledPaymentAttemptId: string }) {
    let prisma = await this.prismaManager.getClient();

    let paymentAttempt = await prisma.scheduledPaymentAttempt.findFirstOrThrow({
      where: { id: payload.scheduledPaymentAttemptId },
    });

    if (paymentAttempt.status != 'inProgress' || !paymentAttempt.transactionHash) {
      return; // Such attempt should not be waited for
    }

    let scheduledPayment = await prisma.scheduledPayment.findFirstOrThrow({
      where: { id: paymentAttempt.scheduledPaymentId },
    });
    let provider = this.ethersProvider.getInstance(scheduledPayment.chainId);
    let scheduledPaymentModule = await this.cardpay.getSDK('ScheduledPaymentModule', provider);

    try {
      await scheduledPaymentModule.executeScheduledPayment(paymentAttempt.transactionHash); // Will wait until mined. If already mined, will return immediately

      await prisma.scheduledPaymentAttempt.update({
        where: { id: paymentAttempt.id },
        data: { status: 'succeeded', endedAt: nowUtc() },
      });

      await prisma.scheduledPayment.update({
        where: { id: scheduledPayment.id },
        data: { scheduledPaymentAttemptsInLastPaymentCycleCount: 0, nextRetryAttemptAt: null },
      });

      if (scheduledPayment.recurringDayOfMonth && scheduledPayment.recurringUntil) {
        let nextPayAt = calculateNextPayAt(
          new Date(),
          scheduledPayment.recurringDayOfMonth,
          scheduledPayment.recurringUntil
        );
        if (nextPayAt && nextPayAt <= scheduledPayment.recurringUntil) {
          await prisma.scheduledPayment.update({
            where: { id: scheduledPayment.id },
            data: { payAt: nextPayAt },
          });
        }
      }
    } catch (error: any) {
      // Known errors are:
      // - Transaction with hash "${txnHash}" was reverted
      // - UnknownHash: payment details generate unregistered spHash
      // - InvalidPeriod: payment executed outside of valid date or period
      // - ExceedMaxGasPrice: gasPrice must be lower than or equal maxGasPrice
      // - PaymentExecutionFailed: safe balance is not enough to make payments and pay fees
      // - OutOfGas: executionGas to low to execute scheduled payment
      let knownErrors = [
        'was reverted',
        'UnknownHash',
        'InvalidPeriod',
        'ExceedMaxGasPrice',
        'PaymentExecutionFailed',
        'OutOfGas',
      ];
      let isKnownError = knownErrors.find((knownError) => error.message.includes(knownError));
      let isWaitTooLong =
        error.message.includes('took too long') && isBefore(paymentAttempt.startedAt!, subDays(nowUtc(), 1));
      if (isKnownError || isWaitTooLong) {
        await prisma.scheduledPaymentAttempt.update({
          data: {
            status: 'failed',
            failureReason: isWaitTooLong
              ? "Waited for more than 1 day for the transaction to be mined, but it wasn't"
              : error.message,
            endedAt: nowUtc(),
          },
          where: {
            id: paymentAttempt.id,
          },
        });

        await prisma.scheduledPayment.update({
          where: { id: scheduledPayment.id },
          data: {
            nextRetryAttemptAt: this.scheduledPaymentFetcher.calculateNextRetryAttemptDate(scheduledPayment),
          },
        });
      } else {
        await this.workerClient.addJob('scheduled-payment-on-chain-execution-waiter', {
          scheduledPaymentAttemptId: paymentAttempt.id,
        });
      }
      return; // We don't want to throw an error here because we don't want the task to be retried - the transaction has obviously failed
    }
  }
}

declare module '@cardstack/hub/tasks' {
  interface KnownTasks {
    'scheduled-payment-on-chain-execution-waiter': ScheduledPaymentOnChainExecutionWaiter;
  }
}
