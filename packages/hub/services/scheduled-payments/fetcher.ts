import { inject } from '@cardstack/di';
import { ScheduledPayment } from '@prisma/client';
import { Prisma } from '@prisma/client';

export default class ScheduledPaymentsFetcherService {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  clock = inject('clock', { as: 'clock' });

  // This query fetches scheduled payments that are due to be executed now.
  // Will prioritize scheduled payments with no payment attempts.
  // After that scheduled payments with the earlier failed payment attempts.
  // Payment scheduler will periodically try to fetch these payments at regular intervals and execute them if they are due.
  // This query mostly relies on the payAt field, which is set to the time when the payment should be executed.
  // In case of one-time payments, payAt is set only initially, and then never changed.
  // In case of recurring payments, payAt will update on every successful payment (to 1 month in the future).
  // It is also important to note that validForDays tells us for how many days the payment is still valid to retry in
  // case it is failing for some reason.

  // In the case of scheduled payments that failed and need to be retried, the query will return only the scheduled payments
  // where enough time has passed since the last failed payment attempt. We allow maximum 8 failed attempts, and the time
  // between attempts is defined in the calculateRetryBackoffsInMinutes method.

  async fetchScheduledPayments(chainId: number, validForDays: number, limit = 10): Promise<ScheduledPayment[]> {
    let prisma = await this.prismaManager.getClient();
    let now = this.clock.utcNow();
    let nowString = now.toISOString(); // We use ISO string to make sure we operate on UTC dates only. Otherwise Prisma will use local time zone.
    let retryBackoffsInMinutes = this.calculateRetryBackoffsInMinutes(validForDays);
    let results: [{ id: string; started_at: Date }] = await prisma.$queryRaw`SELECT 
        scheduled_payments.id AS id,
        last_failed_payment_attempt.started_at
      FROM 
        scheduled_payments
      LEFT JOIN (
        SELECT
          scheduled_payment_attempts.scheduled_payment_id,
          MAX(scheduled_payment_attempts.started_at) AS started_at,
          COUNT(*) as failed_attempts_count
        FROM scheduled_payment_attempts
        INNER JOIN scheduled_payments ON scheduled_payments.id = scheduled_payment_attempts.scheduled_payment_id
        WHERE scheduled_payment_attempts.status = 'failed'
          AND started_at >= scheduled_payments.pay_at
        GROUP BY scheduled_payment_id) AS last_failed_payment_attempt
      ON last_failed_payment_attempt.scheduled_payment_id = scheduled_payments.id
      WHERE 
        (
          scheduled_payments.canceled_at IS NULL
          AND scheduled_payments.chain_id = ${chainId}
          AND scheduled_payments.creation_block_number > 0
          AND scheduled_payments.pay_at > DATE_TRUNC('day', ${nowString}::timestamp)::date - scheduled_payments.valid_for_days
          AND scheduled_payments.pay_at <= ${nowString}::timestamp
          AND COALESCE(failed_attempts_count, 0) < ${retryBackoffsInMinutes.length}
          AND ${nowString}::timestamp >= (COALESCE(last_failed_payment_attempt.started_at, to_timestamp(0)) + (interval '1 minute' * (ARRAY[${Prisma.join(
      retryBackoffsInMinutes
    )}])[COALESCE(failed_attempts_count + 1, 1)]))
          AND (
            (
              scheduled_payments.recurring_day_of_month IS NULL
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
              scheduled_payments.recurring_day_of_month > 0
              AND scheduled_payments.recurring_until >= ${nowString}::timestamp
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

    return prisma.scheduledPayment.findMany({ where: { id: { in: results.map((result) => result.id) } } });
  }

  calculateRetryBackoffsInMinutes(validForDays: number) {
    const ONE_HOUR = 60;
    const SIX_HOURS = 360;
    const TWELVE_HOURS = 720;
    let fixedPart = [0, 5, ONE_HOUR, SIX_HOURS]; // Retry immediately, then after 5 minutes, 1 hour, 6 hours
    let fixedPartSum = fixedPart.reduce((a, b) => a + b, 0);
    let variablePartChunksCount = Math.floor((validForDays * 24 * ONE_HOUR - fixedPartSum) / TWELVE_HOURS);
    let variablePart = Array(variablePartChunksCount).fill(TWELVE_HOURS); // Then every 12 hours until we reach the end of validForDays
    return [...fixedPart, ...variablePart];
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'scheduled-payment-fetcher': ScheduledPaymentsFetcherService;
  }
}
