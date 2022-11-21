import { inject } from '@cardstack/di';
import * as Sentry from '@sentry/node';
import { isBefore, subDays } from 'date-fns';
import { nowUtc } from '../utils/dates';

export default class ScheduledPaymentOnChainCancelationWaiter {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  cardpay = inject('cardpay');
  ethersProvider = inject('ethers-provider', { as: 'ethersProvider' });

  async perform(payload: { scheduledPaymentId: string }) {
    let prisma = await this.prismaManager.getClient();
    let scheduledPayment = await prisma.scheduledPayment.findFirstOrThrow({
      where: { id: payload.scheduledPaymentId },
    });

    let provider = this.ethersProvider.getInstance(scheduledPayment.chainId);
    let scheduledPaymentModule = await this.cardpay.getSDK('ScheduledPaymentModule', provider);

    if (scheduledPayment.cancelationBlockNumber) {
      // Did we somehow spawn this task after it already updated cancelationBlockNumber previously?
      return Sentry.captureException(
        new Error('Task run for scheduled payment that already has a cancelation block number'),
        {
          tags: {
            action: 'scheduled-payment-task',
            scheduledPaymentId: scheduledPayment.id,
          },
        }
      );
    }

    if (!scheduledPayment.cancelationTransactionHash) {
      // This should never happen because we spawn this task only after updating cancelationTransactionHash in the route. But just in case...
      return Sentry.captureException(new Error('Missing transaction hash'), {
        tags: {
          action: 'scheduled-payment-task',
          scheduledPaymentId: scheduledPayment.id,
        },
      });
    }

    if (isBefore(scheduledPayment.canceledAt!, subDays(nowUtc(), 1))) {
      return Sentry.captureException(
        new Error(
          'Scheduled payment has been canceled more than a day ago and the cancelation transaction still has not been mined'
        ),
        {
          tags: {
            action: 'scheduled-payment-task',
            scheduledPaymentId: scheduledPayment.id,
          },
        }
      );
    }

    try {
      let receipt = await scheduledPaymentModule.cancelPaymentOnChain(scheduledPayment.cancelationTransactionHash);
      return await prisma.scheduledPayment.update({
        data: {
          cancelationBlockNumber: receipt.blockNumber, // To let us know that the scheduled payment has been created on chain and that the process of scheduling the payment was completed
        },
        where: {
          id: scheduledPayment.id,
        },
      });
    } catch (error: any) {
      if (error.message.includes('revert')) {
        // Error message from the waitUntilTransactionMined in the SDK will be: Transaction with hash "${txnHash}" was reverted
        await prisma.scheduledPayment.update({
          data: {
            cancelationTransactionError: error.message,
          },
          where: {
            id: scheduledPayment.id,
          },
        });

        return; // We don't want to throw an error here because we don't want the task to be retried - the transaction was obviously reverted
      }

      // At this point, we don't know what error to expect. Let's throw the error so that the task will restart
      Sentry.captureException(error, {
        tags: {
          action: 'scheduled-payment-task',
          scheduledPaymentId: scheduledPayment.id,
        },
      });

      throw error;
    }
  }
}

declare module '@cardstack/hub/tasks' {
  interface KnownTasks {
    'scheduled-payment-on-chain-cancelation-waiter': ScheduledPaymentOnChainCancelationWaiter;
  }
}
