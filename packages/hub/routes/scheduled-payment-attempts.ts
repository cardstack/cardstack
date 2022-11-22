import Koa from 'koa';
import autoBind from 'auto-bind';
import { ensureLoggedIn } from './utils/auth';
import { inject } from '@cardstack/di';
import ScheduledPaymentValidator from '../services/validators/scheduled-payment';
import ScheduledPaymentSerializer from '../services/serializers/scheduled-payment-serializer';
import { ScheduledPayment, ScheduledPaymentAttempt } from '@prisma/client';

export type ScheduledPaymentAttemptWithScheduledPayment = ScheduledPaymentAttempt & {
  scheduledPayment: ScheduledPayment;
};

export default class ScheduledPaymentAttemptsRoute {
  scheduledPaymentValidator: ScheduledPaymentValidator = inject('scheduled-payment-validator', {
    as: 'scheduledPaymentValidator',
  });
  scheduledPaymentSerializer: ScheduledPaymentSerializer = inject('scheduled-payment-serializer', {
    as: 'scheduledPaymentSerializer',
  });
  web3 = inject('web3-http', { as: 'web3' });
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  scheduledPaymentAttemptSerializer = inject('scheduled-payment-attempt-serializer', {
    as: 'scheduledPaymentAttemptSerializer',
  });

  constructor() {
    autoBind(this);
  }

  async list(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let minStartedAt = new Date((ctx.query['filter[started-at][gt]'] as string) || 0);

    let prisma = await this.prismaManager.getClient();

    let attempts = (await prisma.scheduledPaymentAttempt.findMany({
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        status: true,
        transactionHash: true,
        failureReason: true,
        scheduledPaymentId: true,
        scheduledPayment: {
          select: {
            id: true,
            senderSafeAddress: true,
            tokenAddress: true,
            amount: true,
            feeFixedUsd: true,
            feePercentage: true,
            payAt: true,
            recurringUntil: true,
            recurringDayOfMonth: true,
            gasTokenAddress: true,
          },
        },
      },
      where: {
        startedAt: {
          gt: minStartedAt,
        },
        scheduledPayment: {
          userAddress: ctx.state.userAddress,
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
    })) as unknown as ScheduledPaymentAttemptWithScheduledPayment;

    ctx.body = this.scheduledPaymentAttemptSerializer.serialize(attempts);
    ctx.status = 200;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'scheduled-payment-attempts-route': ScheduledPaymentAttemptsRoute;
  }
}
