import { inject } from '@cardstack/di';
import { Prisma, ScheduledPayment } from '@prisma/client';
import { addDays, startOfDay, subDays } from 'date-fns';
import { nowUtc } from '../../utils/dates';

export default class ScheduledPaymentsFetcherService {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  validForDays = 3;

  // This query fetches scheduled payments that are due to be executed now.
  // Will prioritize scheduled payments with no payment attempts.
  // After that scheduled payments with the earlier failed payment attempts.
  // Payment scheduler will periodically try to fetch these payments at regular intervals and execute them if they are due.
  // This query mostly relies on the payAt field, which is set to the time when the payment should be executed.
  // In case of one-time payments, payAt is set only initially, and then never changed.
  // In case of recurring payments, payAt will update on every successful payment (to 1 month in the future).
  // It is also important to note that validForDays tells us for how many days the payment is still valid to retry in
  // case it is failing for some reason.

  async fetchScheduledPayments(limit = 10): Promise<ScheduledPayment[]> {
    let prisma = await this.prismaManager.getClient();
    let _nowUtc = nowUtc();

    let validRecurringDays = [];
    let startValidDate = startOfDay(subDays(_nowUtc, this.validForDays));
    while (startValidDate <= _nowUtc) {
      validRecurringDays.push(startValidDate.getDate());
      startValidDate = addDays(startValidDate, 1);
    }
    let results: [{ id: string; started_at: Date }] = await prisma.$queryRaw`SELECT 
        scheduled_payments.id AS id,
        last_failed_payment_attempt.started_at
      FROM 
        scheduled_payments
      LEFT JOIN (SELECT scheduled_payment_attempts.scheduled_payment_id,
                  MAX(scheduled_payment_attempts.started_at) AS started_at
            FROM scheduled_payment_attempts
            WHERE scheduled_payment_attempts.status = 'failed'
            GROUP BY scheduled_payment_id) AS last_failed_payment_attempt
      ON last_failed_payment_attempt.scheduled_payment_id = scheduled_payments.id
      WHERE 
        (
          scheduled_payments.canceled_at IS NULL 
          AND scheduled_payments.creation_block_number > 0 
          AND (
            (
              scheduled_payments.pay_at > ${startOfDay(subDays(_nowUtc, this.validForDays))}
              AND scheduled_payments.pay_at <= ${_nowUtc}
              AND (
                scheduled_payments.id
              ) NOT IN (
                SELECT 
                  scheduled_payments1.id 
                FROM 
                  scheduled_payments AS scheduled_payments1 
                  INNER JOIN scheduled_payment_attempts AS scheduled_payment_attempts1 
                  ON (scheduled_payment_attempts1.scheduled_payment_id) = (scheduled_payments1.id) 
                WHERE 
                  (
                    (
                      scheduled_payment_attempts1.status = 'succeeded'
                      OR scheduled_payment_attempts1.status = 'in_progress'
                    ) 
                    AND scheduled_payments1.id IS NOT NULL
                  )
              )
            ) 
            OR (
              scheduled_payments.recurring_day_of_month IN (${Prisma.join(validRecurringDays, ',')})
              AND scheduled_payments.recurring_until >= ${_nowUtc}
              AND (
                scheduled_payments.id
              ) NOT IN (
                SELECT 
                  scheduled_payments1.id 
                FROM 
                  scheduled_payments AS scheduled_payments1 
                  INNER JOIN scheduled_payment_attempts AS scheduled_payment_attempts1 
                  ON (scheduled_payment_attempts1.scheduled_payment_id) = (scheduled_payments1.id) 
                WHERE 
                  (
                    scheduled_payment_attempts1.status = 'in_progress'
                    AND scheduled_payments1.id IS NOT NULL
                  )
              )
            )
          )
        )
        ORDER BY last_failed_payment_attempt.started_at ASC NULLS FIRST
        LIMIT ${limit};`;

    // Retrieve scheduledPayment prisma object based on filtered id
    return prisma.scheduledPayment.findMany({ where: { id: { in: results.map((result) => result.id) } } });
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'scheduled-payment-fetcher': ScheduledPaymentsFetcherService;
  }
}
