import shortUUID from 'short-uuid';
import ScheduledPaymentsFetcherService from '../../../services/scheduled-payments/fetcher';
import { setupHub } from '../../helpers/server';
import crypto from 'crypto';
import { addDays, addMinutes, addMonths, subDays, subHours, subMinutes, subMonths } from 'date-fns';
import { ScheduledPayment, ScheduledPaymentAttemptStatusEnum } from '@prisma/client';
import { convertDateToUTC } from '../../../utils/dates';
import { ExtendedPrismaClient } from '../../../services/prisma-manager';

describe('fetching scheduled payments that are due', function () {
  let subject: ScheduledPaymentsFetcherService;
  let now: Date;
  let chainId = 1;
  let validForDays = 3;
  let prisma: ExtendedPrismaClient;

  let { getPrisma, getContainer } = setupHub(this);

  this.beforeEach(async function () {
    subject = await getContainer().lookup('scheduled-payment-fetcher');
    now = convertDateToUTC(new Date());
    prisma = await getPrisma();
  });

  let createScheduledPayment = async (params: any) => {
    return prisma.scheduledPayment.create({
      data: {
        id: shortUUID.uuid(),
        senderSafeAddress: '0x123',
        moduleAddress: '0x456',
        tokenAddress: '0x789',
        gasTokenAddress: '0xdef',
        amount: '1',
        payeeAddress: '0xabc',
        executionGasEstimation: 1,
        maxGasPrice: '1',
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
        chainId,
        userAddress: '0x57022DA74ec3e6d8274918C732cf8864be7da833',
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
      let sp1 = await createScheduledPayment({ payAt: subDays(now, validForDays) }); // still valid to retry
      let sp2 = await createScheduledPayment({ payAt: subDays(now, validForDays - 1) }); // still valid to retry
      let sp3 = await createScheduledPayment({ payAt: now });

      expect((await subject.fetchScheduledPayments(chainId, validForDays)).map((sp) => sp.id)).to.deep.equal([
        sp1.id,
        sp2.id,
        sp3.id,
      ]);
    });

    it('does not fetch scheduled payments with payment attempts in progress', async function () {
      let sp1 = await createScheduledPayment({ payAt: now });
      await createScheduledPaymentAttempt(sp1, now, null, 'inProgress');

      expect(await subject.fetchScheduledPayments(chainId, validForDays)).to.be.empty;
    });

    it('does not fetch scheduled payments with payment attempts that succeeded', async function () {
      let sp1 = await createScheduledPayment({ payAt: subDays(now, 1) });
      await createScheduledPaymentAttempt(sp1, subMinutes(now, 2), subMinutes(now, 1), 'succeeded');

      expect(await subject.fetchScheduledPayments(chainId, validForDays)).to.be.empty;
    });

    it('fetches scheduled payments with payment attempts that failed', async function () {
      let sp1 = await createScheduledPayment({ payAt: subDays(now, 1) }); // was due yesterday
      await createScheduledPaymentAttempt(sp1, subDays(now, 1), addMinutes(subDays(now, 1), 2), 'failed'); // it failed yesterday, but it's still valid to retry now

      expect((await subject.fetchScheduledPayments(chainId, validForDays)).map((sp) => sp.id)).to.deep.equal([sp1.id]);
    });

    it('fetches 3 of 5 scheduled payment that are due in the correct order', async function () {
      //Scheduled payment with no failed payment attempt
      let sp1 = await createScheduledPayment({ payAt: now });

      // scheduled payment with failed payment attempt 1 days ago
      let sp2And3Date = subDays(now, 1);
      let sp2 = await createScheduledPayment({ payAt: sp2And3Date }); // still valid to retry
      let sp3 = await createScheduledPayment({ payAt: sp2And3Date }); // still valid to retry
      await createScheduledPaymentAttempt(sp2, sp2And3Date, addMinutes(sp2And3Date, 5), 'failed');
      await createScheduledPaymentAttempt(sp3, sp2And3Date, addMinutes(sp2And3Date, 5), 'failed');

      //scheduled payment with failed payment attempt 5 hours ago
      let sp4And5Date = subHours(now, 5);
      let sp4 = await createScheduledPayment({ payAt: sp4And5Date });
      let sp5 = await createScheduledPayment({ payAt: sp4And5Date });
      await createScheduledPaymentAttempt(sp4, sp4And5Date, addMinutes(sp4And5Date, 5), 'failed');
      await createScheduledPaymentAttempt(sp5, sp4And5Date, addMinutes(sp4And5Date, 5), 'failed');

      expect((await subject.fetchScheduledPayments(chainId, validForDays, 3)).map((sp) => sp.id)).to.deep.equal([
        sp1.id,
        sp2.id,
        sp3.id,
      ]);
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

      expect((await subject.fetchScheduledPayments(chainId, validForDays)).map((sp) => sp.id)).to.deep.equal([
        sp1.id,
        sp2.id,
      ]);
    });

    it('does not fetch payments that have recurringUntil in the past', async function () {
      await createScheduledPayment({
        recurringDayOfMonth: now.getDate(),
        payAt: now,
        recurringUntil: subDays(now, 1),
      });

      expect(await subject.fetchScheduledPayments(chainId, validForDays)).to.be.empty;
    });

    it('fetches payments that succeeded in the past', async function () {
      let sp1 = await createScheduledPayment({
        recurringUntil: addMonths(now, 6),
        recurringDayOfMonth: now.getDate(),
        payAt: now,
      });

      await createScheduledPaymentAttempt(sp1, subMonths(now, 1), addMinutes(subMonths(now, 1), 1), 'succeeded');

      expect((await subject.fetchScheduledPayments(chainId, validForDays)).map((sp) => sp.id)).to.deep.equal([sp1.id]);
    });

    it('fetches 3 of 5 scheduled payment that are due in the correct order', async function () {
      //Scheduled payment with no failed payment attempt
      let sp1 = await createScheduledPayment({
        recurringUntil: addMonths(now, 6),
        recurringDayOfMonth: now.getDate(),
        payAt: now,
      });

      // scheduled payment with failed payment attempt 1 days ago
      let sp2And3Date = subDays(now, 1);
      let sp2And3RecurringDay = sp2And3Date.getDate();
      let sp2 = await createScheduledPayment({
        recurringUntil: addMonths(now, 6),
        recurringDayOfMonth: sp2And3RecurringDay,
        payAt: sp2And3Date,
      }); // still valid to retry
      let sp3 = await createScheduledPayment({
        recurringUntil: addMonths(now, 6),
        recurringDayOfMonth: sp2And3RecurringDay,
        payAt: sp2And3Date,
      }); // still valid to retry
      await createScheduledPaymentAttempt(sp2, sp2And3Date, addMinutes(sp2And3Date, 5), 'failed');
      await createScheduledPaymentAttempt(sp3, sp2And3Date, addMinutes(sp2And3Date, 5), 'failed');

      //scheduled payment with failed payment attempt 5 hours ago
      let sp4And5Date = subHours(now, 5);
      let sp4And5RecurringDay = sp2And3Date.getDate();
      let sp4 = await createScheduledPayment({
        recurringUntil: addMonths(now, 6),
        recurringDayOfMonth: sp4And5RecurringDay,
        payAt: sp4And5Date,
      }); // still valid to retry
      let sp5 = await createScheduledPayment({
        recurringUntil: addMonths(now, 6),
        recurringDayOfMonth: sp4And5RecurringDay,
        payAt: sp4And5Date,
      }); // still valid to retry
      await createScheduledPaymentAttempt(sp4, sp4And5Date, addMinutes(sp4And5Date, 5), 'failed');
      await createScheduledPaymentAttempt(sp5, sp4And5Date, addMinutes(sp4And5Date, 5), 'failed');

      expect((await subject.fetchScheduledPayments(chainId, validForDays, 3)).map((sp) => sp.id)).to.deep.equal([
        sp1.id,
        sp2.id,
        sp3.id,
      ]);
    });

    it('respects exponential back-off rule when fetching payments for execution', async function () {
      let clock = await getContainer().lookup('clock');
      let utcNow = clock.utcNow;

      let yesterday = subDays(now, 1);
      let sp1 = await createScheduledPayment({ payAt: yesterday });

      clock.utcNow = () => yesterday;
      await createScheduledPaymentAttempt(sp1, yesterday, addMinutes(yesterday, 1), 'failed');

      // First attempt has failed so we do not retry yet after required time has passed
      expect((await subject.fetchScheduledPayments(chainId, validForDays)).map((sp) => sp.id)).to.deep.equal([]);

      // After 5 minutes the payment is available for retry
      clock.utcNow = () => addMinutes(yesterday, 5);
      expect((await subject.fetchScheduledPayments(chainId, validForDays)).map((sp) => sp.id)).to.deep.equal([sp1.id]);
      // It fails again
      await createScheduledPaymentAttempt(sp1, yesterday, addMinutes(yesterday, 5), 'failed');

      // Then it's not available for retry until required time has passed
      expect((await subject.fetchScheduledPayments(chainId, validForDays)).map((sp) => sp.id)).to.deep.equal([]);

      // After 60 minutes the payment is available for retry
      clock.utcNow = () => addMinutes(yesterday, 60);
      expect((await subject.fetchScheduledPayments(chainId, validForDays)).map((sp) => sp.id)).to.deep.equal([sp1.id]);
      // It fails again
      await createScheduledPaymentAttempt(sp1, yesterday, addMinutes(yesterday, 60), 'failed');

      // Then it's not available for retry until required time has passed
      expect((await subject.fetchScheduledPayments(chainId, validForDays)).map((sp) => sp.id)).to.deep.equal([]);

      // After 300 minutes the payment is available for retry
      clock.utcNow = () => addMinutes(yesterday, 360);
      expect((await subject.fetchScheduledPayments(chainId, validForDays)).map((sp) => sp.id)).to.deep.equal([sp1.id]);
      // It fails again
      await createScheduledPaymentAttempt(sp1, yesterday, addMinutes(yesterday, 360), 'failed');

      // Then it's not available for retry until required time has passed
      expect((await subject.fetchScheduledPayments(chainId, validForDays)).map((sp) => sp.id)).to.deep.equal([]);

      // After 720 minutes (12 hours) the payment is available for retry
      clock.utcNow = () => addMinutes(yesterday, 720);
      expect((await subject.fetchScheduledPayments(chainId, validForDays)).map((sp) => sp.id)).to.deep.equal([sp1.id]);
      // It succeeds
      await createScheduledPaymentAttempt(sp1, yesterday, addMinutes(yesterday, 720), 'succeeded');

      // Then it's not available anymore because it succeeded
      expect((await subject.fetchScheduledPayments(chainId, validForDays)).map((sp) => sp.id)).to.deep.equal([]);

      clock.utcNow = utcNow; // Restore clock
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

      expect(await subject.fetchScheduledPayments(chainId, validForDays)).to.be.empty;
    });

    it('does not fetch scheduled payments that have a blank creationBlockNumber', async function () {
      await createScheduledPayment({
        recurringUntil: addMonths(now, 6),
        recurringDayOfMonth: now.getDate(),
        payAt: now,
        creationBlockNumber: null,
      });

      expect(await subject.fetchScheduledPayments(chainId, validForDays)).to.be.empty;
    });

    it('does not fetch payments that were attempted for maximum amount of times', async function () {
      let sp1 = await createScheduledPayment({ payAt: subDays(now, 3) });
      let sp2 = await createScheduledPayment({ payAt: subDays(now, 3) });
      expect((await subject.fetchScheduledPayments(chainId, validForDays)).map((sp) => sp.id)).to.deep.equal([
        sp1.id,
        sp2.id,
      ]);

      for await (let i of Array(subject.calculateRetryBackoffsInMinutes(validForDays).length).keys()) {
        await createScheduledPaymentAttempt(
          sp1,
          addMinutes(subDays(now, 3), i),
          addMinutes(subDays(now, 3), i + 1),
          'failed'
        );
      }

      // sp1 had reached max attempts, so we don't expect it to be fetched again
      expect((await subject.fetchScheduledPayments(chainId, validForDays)).map((sp) => sp.id)).to.deep.equal([sp2.id]);
    });

    it('calculates exponential backoff values correctly', async function () {
      expect(subject.calculateRetryBackoffsInMinutes(validForDays)).to.deep.equal([
        0, 5, 60, 360, 720, 720, 720, 720, 720,
      ]);
    });
  });
});
