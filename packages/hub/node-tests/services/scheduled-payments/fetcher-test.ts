import shortUUID from 'short-uuid';
import ScheduledPaymentsFetcherService from '../../../services/scheduled-payments/fetcher';
import { setupHub } from '../../helpers/server';
import crypto from 'crypto';
import { addDays, addMinutes, subDays, subMinutes } from 'date-fns';
import { ScheduledPayment, ScheduledPaymentAttemptStatusEnum } from '@prisma/client';

describe('fetching scheduled payments that are due', function () {
  let subject: ScheduledPaymentsFetcherService;
  let { getPrisma, getContainer } = setupHub(this);

  this.beforeEach(async function () {
    subject = await getContainer().lookup('scheduled-payments-fetcher');
  });

  let createScheduledPayment = async (payAt: Date) => {
    let prisma = await getPrisma();
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
        nonce: 'abc',
        payAt,
        spHash: crypto.randomBytes(20).toString('hex'),
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
    let prisma = await getPrisma();
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

  describe('scheduled payments with no payment attempts', async function () {
    it('fetches the correct payments that are due to execute now', async function () {
      let now = new Date();
      let validForDays = subject.validForDays;

      await createScheduledPayment(addDays(now, -validForDays - 1)); // not valid to retry anymore
      let sp1 = await createScheduledPayment(addDays(now, -validForDays)); // still valid to retry
      let sp2 = await createScheduledPayment(addDays(now, -validForDays + 1)); // still valid to retry
      let sp3 = await createScheduledPayment(now);
      await createScheduledPayment(addDays(now, 1)); // future payment for tomorrow, not due to execute now
      await createScheduledPayment(addDays(now, 2)); // future payment for day after tomorrow, not due to execute now

      expect((await subject.fetchScheduledPayments()).map((sp: ScheduledPayment) => sp.id)).to.deep.equal([
        sp1.id,
        sp2.id,
        sp3.id,
      ]);
    });
  });

  describe('scheduled payments with payment attempts in progress', async function () {
    it('fetches the correct payments that are due to execute now', async function () {
      let now = new Date();

      let sp1 = await createScheduledPayment(now);
      await createScheduledPaymentAttempt(sp1, now, null, 'inProgress');

      expect(await subject.fetchScheduledPayments()).to.be.empty;
    });
  });

  describe('scheduled payments with payment attempts that succeeded', async function () {
    it('fetches the correct payments that are due to execute now', async function () {
      let now = new Date();

      let sp1 = await createScheduledPayment(subDays(now, 1));
      await createScheduledPaymentAttempt(sp1, subMinutes(now, 2), subMinutes(now, 1), 'succeeded');

      expect(await subject.fetchScheduledPayments()).to.be.empty;
    });
  });

  describe('scheduled payments with payment attempts that failed', async function () {
    it('fetches the correct payments that are due to execute now', async function () {
      let now = new Date();

      let sp1 = await createScheduledPayment(subDays(now, 1)); // was due yesterday
      await createScheduledPaymentAttempt(sp1, subDays(now, 1), addMinutes(subDays(now, 1), 2), 'failed'); // it failed yesterday, but it's still valid to retry now

      expect((await subject.fetchScheduledPayments()).map((sp: ScheduledPayment) => sp.id)).to.deep.equal([sp1.id]);
    });
  });
});

declare module '@cardstack/di' {
  interface KnownServices {
    'scheduled-payments-fetcher': ScheduledPaymentsFetcherService;
  }
}
