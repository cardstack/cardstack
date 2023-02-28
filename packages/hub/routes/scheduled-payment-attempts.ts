import Koa from 'koa';
import autoBind from 'auto-bind';
import { ensureLoggedIn } from './utils/auth';
import { inject } from '@cardstack/di';
import { ScheduledPayment, ScheduledPaymentAttempt, ScheduledPaymentAttemptStatusEnum } from '@prisma/client';
import { isValidDate } from '../utils/dates';

export type ScheduledPaymentAttemptWithScheduledPayment = ScheduledPaymentAttempt & {
  scheduledPayment: ScheduledPayment;
};

export default class ScheduledPaymentAttemptsRoute {
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

    let minStartedAt: Date | undefined = undefined;
    let minStartedAtQuery = ctx.query['filter[started-at][gt]'] as string;
    if (minStartedAtQuery) {
      let parsedDate = new Date(minStartedAtQuery);
      if (isValidDate(parsedDate)) {
        minStartedAt = parsedDate;
      }
    }

    let status: ScheduledPaymentAttemptStatusEnum | undefined = undefined;
    let statusQuery = ctx.query['filter[status]'] as string;
    if (['failed', 'succeeded', 'inProgress'].includes(statusQuery)) {
      status = statusQuery as ScheduledPaymentAttemptStatusEnum;
    }

    let senderSafeAddress = ctx.query['filter[sender-safe-address]']
      ? String(ctx.query['filter[sender-safe-address]'])
      : undefined;

    let chainId: number | undefined = undefined;
    let chainIdQuery = ctx.query['filter[chain-id]'] as string;
    if (!isNaN(chainIdQuery as unknown as number)) {
      chainId = parseInt(chainIdQuery);
    }

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
            moduleAddress: true,
            amount: true,
            payeeAddress: true,
            executionGasEstimation: true,
            maxGasPrice: true,
            feeFixedUsd: true,
            feePercentage: true,
            payAt: true,
            recurringDayOfMonth: true,
            recurringUntil: true,
            validForDays: true,
            spHash: true,
            gasTokenAddress: true,
            chainId: true,
            createdAt: true,
            canceledAt: true,
          },
        },
      },
      where: {
        startedAt: {
          gt: minStartedAt,
        },
        status: {
          equals: status,
        },
        scheduledPayment: {
          userAddress: ctx.state.userAddress,
          senderSafeAddress,
          chainId,
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
