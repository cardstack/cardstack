import { inject } from '@cardstack/di';
import { ScheduledPayment } from '@prisma/client';
import { startOfDay, subDays } from 'date-fns';
import { convertDateToUTC } from '../../utils/dates';

export default class ScheduledPaymentsFetcherService {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  validForDays = 10; // Keep this in sync with the value in the config contract

  // This query fetches scheduled payments that are due to be executed now.
  // Payment scheduler will periodically try to fetch these payments at regular intervals and execute them if they are due.
  // This query mostly relies on the payAt field, which is set to the time when the payment should be executed.
  // In case of one-time payments, payAt is set only initially, and then never changed.
  // In case of recurring payments, payAt will update on every successful payment (to 1 month in the future).
  // It is also important to note that validForDays tells us for how many days the payment is still valid to retry in
  // case it is failing for some reason.

  async fetchScheduledPayments(): Promise<ScheduledPayment[]> {
    let prisma = await this.prismaManager.getClient();
    let nowUtc = convertDateToUTC(new Date());

    return prisma.scheduledPayment.findMany({
      where: {
        canceledAt: null,
        creationBlockNumber: {
          gt: 0,
        },
        payAt: {
          gt: startOfDay(subDays(nowUtc, this.validForDays)),
          lte: nowUtc,
        },
        OR: [
          {
            AND: {
              recurringDayOfMonth: null,
              scheduledPaymentAttempts: {
                none: {
                  OR: [{ status: 'succeeded' }, { status: 'inProgress' }],
                },
              },
            },
          },
          {
            AND: {
              recurringDayOfMonth: {
                gt: 0,
              },
              recurringUntil: {
                gte: nowUtc,
              },
              scheduledPaymentAttempts: {
                none: {
                  status: 'inProgress',
                },
              },
            },
          },
        ],
      },
    });
  }
}
