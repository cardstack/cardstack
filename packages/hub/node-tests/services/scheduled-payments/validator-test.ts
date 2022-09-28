import { ScheduledPayment } from '@prisma/client';
import { setupHub } from '../../helpers/server';

describe('ScheduledPaymentValidator', function () {
  let { getContainer } = setupHub(this);

  it('validates scheduled payment with missing attrs', async function () {
    let subject = await getContainer().lookup('scheduled-payment-validator');

    const scheduledPayment: Partial<ScheduledPayment> = {};

    let errors = await subject.validate(scheduledPayment);
    expect(errors).deep.equal({
      senderSafeAddress: ['is required'],
      tokenAddress: ['is required'],
      moduleAddress: ['is required'],
      amount: ['is required'],
      payeeAddress: ['is required'],
      executionGasEstimation: ['is required'],
      maxGasPrice: ['is required'],
      feeFixedUsd: ['is required'],
      payAt: ['is required'],
      feePercentage: ['is required'],
      salt: ['is required'],
      spHash: ['is required'],
      chainId: ['is required'],
      userAddress: ['is required'],
      recurringDayOfMonth: [],
      recurringUntil: [],
      validForDays: [],
    });
  });

  it('validates scheduled payment with invalid addresses', async function () {
    let subject = await getContainer().lookup('scheduled-payment-validator');

    const scheduledPayment: Partial<ScheduledPayment> = {
      senderSafeAddress: '0x123',
      moduleAddress: '0x123',
      tokenAddress: '0x123',
      payeeAddress: '0x123',
    };

    let errors = await subject.validate(scheduledPayment);

    expect(errors.senderSafeAddress).deep.equal(['is not a valid address']);
    expect(errors.moduleAddress).deep.equal(['is not a valid address']);
    expect(errors.tokenAddress).deep.equal(['is not a valid address']);
    expect(errors.payeeAddress).deep.equal(['is not a valid address']);
  });
});
