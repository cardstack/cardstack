import { ScheduledPayment } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime';
import { setupHub } from '../../helpers/server';

describe('ScheduledPaymentValidator', function () {
  let { getContainer } = setupHub(this);

  it('validates scheduled payment with missing attrs', async function () {
    let subject = await getContainer().lookup('scheduled-payment-validator');

    const scheduledPayment: Partial<ScheduledPayment> = {};

    let errors = await subject.validate(scheduledPayment);
    expect(errors).deep.equal({
      senderSafeAddress: ['sender safe address is required'],
      tokenAddress: ['token address is required'],
      moduleAddress: ['module address is required'],
      amount: ['amount is required'],
      payeeAddress: ['payee address is required'],
      executionGasEstimation: ['execution gas estimation is required'],
      maxGasPrice: ['max gas price is required'],
      feeFixedUsd: ['fee fixed usd is required'],
      payAt: ['pay at is required'],
      feePercentage: ['fee percentage is required'],
      gasTokenAddress: ['gas token address is required'],
      salt: ['salt is required'],
      spHash: ['sp hash is required'],
      chainId: ['chain id is required'],
      userAddress: ['user address is required'],
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

    expect(errors.senderSafeAddress).deep.equal(['sender safe address is not a valid address']);
    expect(errors.moduleAddress).deep.equal(['module address is not a valid address']);
    expect(errors.tokenAddress).deep.equal(['token address is not a valid address']);
    expect(errors.payeeAddress).deep.equal(['payee address is not a valid address']);
  });

  it('validates scheduled payment with invalid chain', async function () {
    let subject = await getContainer().lookup('scheduled-payment-validator');

    const scheduledPayment: Partial<ScheduledPayment> = {
      chainId: 99,
    };

    let errors = await subject.validate(scheduledPayment);
    expect(errors.chainId).deep.equal(['chain is not supported']);
  });

  it('validates scheduled payment with invalid fee', async function () {
    let subject = await getContainer().lookup('scheduled-payment-validator');

    const scheduledPayment: Partial<ScheduledPayment> = {
      chainId: 1, //Mainnet
      feeFixedUsd: new Decimal(0),
      feePercentage: new Decimal(0),
    };

    let errors = await subject.validate(scheduledPayment);
    expect(errors.feeFixedUsd).deep.equal(['fee USD must be greater than or equal 0.25']);
    expect(errors.feePercentage).deep.equal(['fee percentage must be greater than or equal 0.25']);
  });
});
