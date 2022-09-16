import { inject } from '@cardstack/di';
import * as Sentry from '@sentry/node';

export default class ScheduledPaymentOnChainCreationWaiter {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  web3 = inject('web3-http', { as: 'web3' });
  cardpay = inject('cardpay');

  async perform(payload: { scheduledPaymentId: string }) {
    let prisma = await this.prismaManager.getClient();

    let scheduledPaymentModule = await this.cardpay.getSDK('ScheduledPaymentModule', this.web3.getInstance());
    let scheduledPayment = await prisma.scheduledPayment.findFirstOrThrow({
      where: { id: payload.scheduledPaymentId },
    });

    if (scheduledPayment.creationBlockNumber) {
      return;
    }

    if (!scheduledPayment.creationTransactionHash) {
      Sentry.captureException(
        new Error('No transaction hash while trying to wait for on chain creation of a scheduled payment'),
        {
          tags: {
            action: 'scheduled-payment-task',
            scheduledPaymentId: scheduledPayment.id,
          },
        }
      );
    } else {
      let receipt = await scheduledPaymentModule.schedulePayment(scheduledPayment.creationTransactionHash);
      await prisma.scheduledPayment.update({
        data: {
          creationBlockNumber: receipt.blockNumber, // To let us know that the scheduled payment has been created on chain and that the process of scheduling payment was completed
        },
        where: {
          id: scheduledPayment.id,
        },
      });
    }
  }
}

declare module '@cardstack/hub/tasks' {
  interface KnownTasks {
    'scheduled-payment-on-chain-creation-waiter': ScheduledPaymentOnChainCreationWaiter;
  }
}
