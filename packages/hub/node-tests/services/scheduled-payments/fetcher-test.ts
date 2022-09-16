import shortUUID from 'short-uuid';
import ScheduledPaymentsFetcherService from '../../../services/scheduled-payments/fetcher';
import { setupHub } from '../../helpers/server';
import crypto from 'crypto';
import { addDays, addMinutes, addMonths, subDays, subMinutes, subMonths } from 'date-fns';
import { ScheduledPayment, ScheduledPaymentAttemptStatusEnum } from '@prisma/client';
import { convertDateToUTC } from '../../../utils/dates';
import { ExtendedPrismaClient } from '../../../services/prisma-manager';

describe('fetching scheduled payments that are due', function () {
  let subject: ScheduledPaymentsFetcherService;
  let now: Date;
  let validForDays: number;
  let prisma: ExtendedPrismaClient;

  let { getPrisma, getContainer } = setupHub(this);

  this.beforeEach(async function () {
    subject = await getContainer().lookup('scheduled-payment-fetcher');
    now = convertDateToUTC(new Date());
    validForDays = subject.validForDays;
    prisma = await getPrisma();
  });

  let createScheduledPayment = async (params: any) => {
    return prisma.scheduledPayment.create({
      data: {
        id: shortUUID.uuid(),
        senderSafeAddress: '0x123',
        moduleAddress: '0x456',
        tokenAddress: '0x789',
        amount: 1,
        payeeAddress: '0xabc',
        executionGasEstimation: 1,
        maxGasPrice: 1,
        feeFixedUsd: 1,
        feePercentage: 1,
        salt: 'abc',
        payAt: params.payAt,
        recurringDayOfMonth: params.recurringDayOfMonth,
        recurringUntil: params.recurringUntil,
        validForDays: params.validForDays,
        spHash: crypto.randomBytes(20).toString('hex'),
        canceledAt: params.canceledAt,
        creationBlockNumber: 'creationBlockNumber' in params ? params.creationBlockNumber : 1,
        chainId: 1,
      },
    });
  };

  let createScheduledPaymentAttempt = async (
    scheduledPayment: ScheduledPayment,
    startedAt: Date,
    endedAt: Date | null,
    status: ScheduledPaymentAttemptStatusEnum
  ) => {
    return prisma.scheduledPaymentAttempt.create({
      data: {
        id: shortUUID.uuid(),
        startedAt,
        endedAt,
        status,
        scheduledPaymentId: scheduledPayment.id,
      },
    });
  };

  describe('one-time scheduled payments', function () {
    it('fetches scheduled payments that are due', async function () {
      await createScheduledPayment({ payAt: addDays(now, -validForDays - 1) }); // not valid to retry anymore
      let sp1 = await createScheduledPayment({ payAt: subDays(now, validForDays) }); // still valid to retry
      let sp2 = await createScheduledPayment({ payAt: subDays(now, validForDays - 1) }); // still valid to retry
      let sp3 = await createScheduledPayment({ payAt: now });
      await createScheduledPayment({ payAt: addDays(now, 1) }); // future payment for tomorrow, not due to execute now
      await createScheduledPayment({ payAt: addDays(now, 2) }); // future payment for day after tomorrow, not due to execute now

      expect((await subject.fetchScheduledPayments()).map((sp) => sp.id)).to.deep.equal([sp1.id, sp2.id, sp3.id]);
    });

    it('does not fetch scheduled payments with payment attempts in progress', async function () {
      let sp1 = await createScheduledPayment({ payAt: now });
      await createScheduledPaymentAttempt(sp1, now, null, 'inProgress');

      expect(await subject.fetchScheduledPayments()).to.be.empty;
    });

    it('does not fetch scheduled payments with payment attempts that succeeded', async function () {
      let sp1 = await createScheduledPayment({ payAt: subDays(now, 1) });
      await createScheduledPaymentAttempt(sp1, subMinutes(now, 2), subMinutes(now, 1), 'succeeded');

      expect(await subject.fetchScheduledPayments()).to.be.empty;
    });

    it('fetches scheduled payments with payment attempts that failed', async function () {
      let sp1 = await createScheduledPayment({ payAt: subDays(now, 1) }); // was due yesterday
      await createScheduledPaymentAttempt(sp1, subDays(now, 1), addMinutes(subDays(now, 1), 2), 'failed'); // it failed yesterday, but it's still valid to retry now

      expect((await subject.fetchScheduledPayments()).map((sp) => sp.id)).to.deep.equal([sp1.id]);
    });
  });

  describe('recurring scheduled payments', function () {
    it('fetches scheduled payments that are due', async function () {
      // not valid to retry anymore
      await createScheduledPayment({
        recurringUntil: addMonths(now, 6),
        recurringDayOfMonth: subDays(now, validForDays + 1).getDate(),
        payAt: subDays(now, validForDays + 1),
      });

      // valid to retry
      let sp1 = await createScheduledPayment({
        recurringUntil: addMonths(now, 6),
        recurringDayOfMonth: subDays(now, 1).getDate(),
        payAt: subDays(now, 1),
      });

      // due now
      let sp2 = await createScheduledPayment({
        recurringUntil: addMonths(now, 6),
        recurringDayOfMonth: now.getDate(),
        payAt: now,
      });

      // future payment for tomorrow, not due to execute now
      await createScheduledPayment({
        recurringUntil: addMonths(now, 6),
        recurringDayOfMonth: addDays(now, 1).getDate(),
        payAt: addDays(now, 1),
      });

      expect((await subject.fetchScheduledPayments()).map((sp) => sp.id)).to.deep.equal([sp1.id, sp2.id]);
    });

    it('does not fetch payments that have recurringUntil in the past', async function () {
      await createScheduledPayment({
        recurringDayOfMonth: now.getDate(),
        payAt: now,
        recurringUntil: subDays(now, 1),
      });

      expect(await subject.fetchScheduledPayments()).to.be.empty;
    });

    it('fetches payments that succeeded in the past', async function () {
      let sp1 = await createScheduledPayment({
        recurringUntil: addMonths(now, 6),
        recurringDayOfMonth: now.getDate(),
        payAt: now,
      });

      await createScheduledPaymentAttempt(sp1, subMonths(now, 1), addMinutes(subMonths(now, 1), 1), 'succeeded');

      expect((await subject.fetchScheduledPayments()).map((sp) => sp.id)).to.deep.equal([sp1.id]);
    });
  });

  describe('both types of scheduled payments', function () {
    it('does not fetch scheduled payments that are canceled', async function () {
      await createScheduledPayment({
        recurringUntil: addMonths(now, 6),
        recurringDayOfMonth: now.getDate(),
        payAt: now,
        canceledAt: now,
      });

      expect(await subject.fetchScheduledPayments()).to.be.empty;
    });

    it('does not fetch scheduled payments that have a blank creationBlockNumber', async function () {
      await createScheduledPayment({
        recurringUntil: addMonths(now, 6),
        recurringDayOfMonth: now.getDate(),
        payAt: now,
        creationBlockNumber: null,
      });

      expect(await subject.fetchScheduledPayments()).to.be.empty;
    });
  });
});

declare module '@cardstack/di' {
  interface KnownServices {
    'scheduled-payment-fetcher': ScheduledPaymentsFetcherService;
  }
}
