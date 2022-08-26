import { inject } from '@cardstack/di';
import { startOfDay, subDays } from 'date-fns';

export default class ScheduledPaymentsFetcherService {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  validForDays = 10; // Keep this in sync with the value in the config contract

  async fetchScheduledPayments(): Promise<any> {
    let prisma = await this.prismaManager.getClient();

    return prisma.scheduledPayment.findMany({
      where: {
        canceledAt: null,
        payAt: {
          lte: new Date(),
          gt: startOfDay(subDays(new Date(), this.validForDays)),
        },
        scheduledPaymentAttempts: {
          none: {
            OR: [{ status: 'succeeded' }, { status: 'inProgress' }],
          },
        },
      },
    });
  }
}
