import { inject } from '@cardstack/di';
import { subMinutes } from 'date-fns';
import { nowUtc } from '../../utils/dates';

export const CREATION_WITHOUT_TX_HASH_ALLOWED_MINUTES = 2;
export const CREATION_UNMINED_ALLOWED_MINUTES = 3 * 60;
export const CANCELATION_WITHOUT_TX_HASH_ALLOWED_MINUTES = CREATION_WITHOUT_TX_HASH_ALLOWED_MINUTES;
export const CANCELATION_UNMINED_ALLOWED_MINUTES = CREATION_UNMINED_ALLOWED_MINUTES;
export const UNATTEMPTED_ALLOWED_MINUTES = 24 * 60;
export const ATTEMPTS_WITHOUT_TX_HASH_ALLOWED_MINUTES = 60;
export const UNFINISHED_ATTEMPT_DURATION_ALLOWED_MINUTES = 24 * 60;

function addToMessages(collection: any, message: string, messages: string[]) {
  if (collection.length == 0) return;

  messages.push(`${message}: ${collection.map((item: any) => item.id).join(', ')}`);
}

export interface IntegrityCheckResult {
  name: string;
  status: 'degraded' | 'operational';
  message: string | null;
}

export default class DataIntegrityChecksScheduledPayments {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });

  async check(): Promise<IntegrityCheckResult> {
    let prisma = await this.prismaManager.getClient();

    // This can happen if the SDK call to create a scheduled payment fails somewhere in the middle of the process (i.e. the new
    // scheduled payment is created in the DB but something went wrong when submitting the transaction to the blockchain)
    let scheduledPaymentsWithoutCreationTxHash = await prisma.scheduledPayment.findMany({
      where: {
        creationTransactionHash: null,
        createdAt: {
          lt: subMinutes(nowUtc(), CREATION_WITHOUT_TX_HASH_ALLOWED_MINUTES),
        },
      },
    });

    // Blockchain transaction to register a scheduled payment was submitted but it's still unmined after a while.
    // Unsure why this would happen but it needs to be investigated if it happens (gas price too low to compete?)
    let unminedScheduledPaymentCreations = await prisma.scheduledPayment.findMany({
      where: {
        creationBlockNumber: null,
        createdAt: {
          lt: subMinutes(nowUtc(), CREATION_UNMINED_ALLOWED_MINUTES),
        },
        creationTransactionError: null,
      },
    });

    // Similarly as above, but for the cancelation transaction.
    let scheduledPaymentsWithoutCancelationTxHash = await prisma.scheduledPayment.findMany({
      where: {
        cancelationTransactionHash: null,
        canceledAt: {
          lt: subMinutes(nowUtc(), CANCELATION_WITHOUT_TX_HASH_ALLOWED_MINUTES),
        },
      },
    });

    // Similarly as above, but for the cancelation transaction.
    let unminedScheduledPaymentCancelations = await prisma.scheduledPayment.findMany({
      where: {
        cancelationBlockNumber: null,
        canceledAt: {
          lt: subMinutes(nowUtc(), CANCELATION_UNMINED_ALLOWED_MINUTES),
        },
        creationTransactionError: null,
      },
    });

    // Scheduled payment was due to be executed but it wasn't attempted on time
    // This can happen if the scheduler worker is not running or if the scheduled payment fetcher is not working properly.
    let unattemptedScheduledPayments = await prisma.scheduledPayment.findMany({
      where: {
        payAt: {
          lt: subMinutes(nowUtc(), 60),
          gt: subMinutes(nowUtc(), UNATTEMPTED_ALLOWED_MINUTES),
        },
        scheduledPaymentAttempts: {
          none: {
            startedAt: {
              gt: subMinutes(nowUtc(), UNATTEMPTED_ALLOWED_MINUTES),
            },
          },
        },
      },
    });

    // Scheduled payment was attempted but the transaction hash was not recorded. It can indicate a problem in the executePayment
    // where we submit the transaction to the blockchain.
    let scheduledPaymentAttemptsWithoutTxHash = await prisma.scheduledPaymentAttempt.findMany({
      where: {
        startedAt: {
          lte: subMinutes(nowUtc(), ATTEMPTS_WITHOUT_TX_HASH_ALLOWED_MINUTES),
        },
        transactionHash: null,
        status: 'inProgress',
      },
    });

    // Scheduled payment was attempted but the attempt is taking too long to finish. This can happen if the transaction is stuck
    // for some reason (i.e. gas price too low to compete). Needs to be investigated if this happens.
    let stuckScheduledPaymentAttempts = await prisma.scheduledPaymentAttempt.findMany({
      where: {
        startedAt: {
          lte: subMinutes(nowUtc(), UNFINISHED_ATTEMPT_DURATION_ALLOWED_MINUTES),
        },
        endedAt: null,
      },
    });

    let errorMessages: string[] = [];

    addToMessages(
      scheduledPaymentsWithoutCreationTxHash,
      'scheduled payments without creationTransactionHash',
      errorMessages
    );
    addToMessages(
      unminedScheduledPaymentCreations,
      'scheduled payment creations that should be mined by now',
      errorMessages
    );

    addToMessages(
      scheduledPaymentsWithoutCancelationTxHash,
      'scheduled payments without cancelationTransactionHash',
      errorMessages
    );

    addToMessages(
      unminedScheduledPaymentCancelations,
      'scheduled payment cancelations that should be mined by now',
      errorMessages
    );

    addToMessages(
      unattemptedScheduledPayments,
      'scheduled payments that should have been attempted by now',
      errorMessages
    );

    addToMessages(stuckScheduledPaymentAttempts, 'stuck scheduled payment attempts', errorMessages);

    addToMessages(
      scheduledPaymentAttemptsWithoutTxHash,
      'scheduled payment attempts without transaction hash',
      errorMessages
    );

    return {
      name: 'scheduled-payments',
      status: errorMessages.length > 0 ? 'degraded' : 'operational',
      message: errorMessages.length > 0 ? errorMessages.join('; ') : null,
    };
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'data-integrity-checks-scheduled-payments': DataIntegrityChecksScheduledPayments;
  }
}
