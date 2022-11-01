import { JsonRpcProvider } from '@cardstack/cardpay-sdk';
import { inject } from '@cardstack/di';
import { isBefore, subDays } from 'date-fns';
import { getHttpRpcUrlByChain } from '../services/scheduled-payments/executor';

import { nowUtc } from '../utils/dates';

export default class ScheduledPaymentOnChainExecutionWaiter {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  cardpay = inject('cardpay');
  workerClient = inject('worker-client', { as: 'workerClient' });

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
    let rpcUrl = getHttpRpcUrlByChain(scheduledPayment.chainId);
    let provider = new JsonRpcProvider(rpcUrl, scheduledPayment.chainId);
    let scheduledPaymentModule = await this.cardpay.getSDK('ScheduledPaymentModule', provider);

    try {
      await scheduledPaymentModule.executeScheduledPayment(paymentAttempt.transactionHash); // Will wait until mined. If already mined, will return immediately
      await prisma.scheduledPaymentAttempt.update({
        where: { id: paymentAttempt.id },
        data: { status: 'succeeded', endedAt: nowUtc() },
      });
    } catch (error: any) {
      // waitUntilTransactionMined will return "Transaction took too long to complete" in case it wasn't mined in 60 minutes.
      // In this case we want to restart the task and wait some more. We could throw an error here so that the worker would restart the task, but
      // due to the exponential-backoff it could take some time before the waiting can start again. That's why we just spawn a new task directly.
      if (error.message.includes('took too long')) {
        if (isBefore(paymentAttempt.startedAt!, subDays(nowUtc(), 1))) {
          await prisma.scheduledPaymentAttempt.update({
            data: {
              status: 'failed',
              failureReason: "Waited for more than 1 day for the transaction to be mined, but it wasn't",
              endedAt: nowUtc(),
            },
            where: {
              id: paymentAttempt.id,
            },
          });
        } else {
          await this.workerClient.addJob('scheduled-payment-on-chain-execution-waiter', {
            scheduledPaymentAttemptId: paymentAttempt.id,
          });
        }

        return;
      }

      // Known errors are:
      // - Transaction with hash "${txnHash}" was reverted
      // - UnknownHash: payment details generate unregistered spHash
      // - InvalidPeriod: payment executed outside of valid date or period
      // - ExceedMaxGasPrice: gasPrice must be lower than or equal maxGasPrice
      // - PaymentExecutionFailed: safe balance is not enough to make payments and pay fees
      // - OutOfGas: executionGas to low to execute scheduled payment
      //
      // In these cases we want to mark the payment attempt as failed and let the scheduler's logic to figure out when to try again.
      await prisma.scheduledPaymentAttempt.update({
        data: {
          status: 'failed',
          failureReason: error.message,
          endedAt: nowUtc(),
        },
        where: {
          id: paymentAttempt.id,
        },
      });

      return; // We don't want to throw an error here because we don't want the task to be retried - the transaction has obviously failed
    }
  }
}

declare module '@cardstack/hub/tasks' {
  interface KnownTasks {
    'scheduled-payment-on-chain-execution-waiter': ScheduledPaymentOnChainExecutionWaiter;
  }
}
