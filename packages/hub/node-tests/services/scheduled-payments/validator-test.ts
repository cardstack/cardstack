import { ScheduledPayment } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime';
import { registry, setupHub } from '../../helpers/server';
import { Networkish, TokenDetail } from '@cardstack/cardpay-sdk';

class StubCardpaySDK {
  getConstantByNetwork(name: string, network: Networkish) {
    if (!network) {
      throw new Error(`network can't be null`);
    }

    switch (name) {
      case 'scheduledPaymentFeeFixedUSD':
        return 0.25;
      case 'scheduledPaymentFeePercentage':
        return 0.1;
      default:
        throw new Error(`unsupported mock cardpay`);
    }
  }

  fetchSupportedGasTokens(network: Networkish): TokenDetail[] {
    if (!network) {
      throw new Error(`network can't be null`);
    }

    return [
      {
        address: '0x52031d287Bb58E26A379A7Fec2c84acB54f54fe3',
        name: 'CARD Token',
        symbol: 'CARD.CPXD',
        decimals: 18,
      },
      {
        address: '0x26F2319Fbb44772e0ED58fB7c99cf8da59e2b5BE',
        name: 'DAI Token',
        symbol: 'DAI.CPXD',
        decimals: 18,
      },
    ];
  }
}

describe('ScheduledPaymentValidator', function () {
  let { getContainer } = setupHub(this);

  this.beforeEach(async function () {
    registry(this).register('cardpay', StubCardpaySDK);
  });

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
      feeFixedUsd: new Decimal(0.1),
      feePercentage: new Decimal(0.05),
    };

    let errors = await subject.validate(scheduledPayment);
    expect(errors.feeFixedUsd).deep.equal(['fee USD must be greater than or equal 0.25']);
    expect(errors.feePercentage).deep.equal(['fee percentage must be greater than or equal 0.1']);
  });

  it('validates scheduled payment with fee percentage lower than 0', async function () {
    let subject = await getContainer().lookup('scheduled-payment-validator');

    const scheduledPayment: Partial<ScheduledPayment> = {
      chainId: 1, //Mainnet
      feeFixedUsd: new Decimal(0.25),
      feePercentage: new Decimal(-1),
    };

    let errors = await subject.validate(scheduledPayment);
    expect(errors.feePercentage).deep.equal(['fee percentage must be between 0 and 100']);
  });

  it('validates scheduled payment with fee percentage greater than 100', async function () {
    let subject = await getContainer().lookup('scheduled-payment-validator');

    const scheduledPayment: Partial<ScheduledPayment> = {
      chainId: 1, //Mainnet
      feeFixedUsd: new Decimal(0.25),
      feePercentage: new Decimal(101),
    };

    let errors = await subject.validate(scheduledPayment);
    expect(errors.feePercentage).deep.equal(['fee percentage must be between 0 and 100']);
  });

  it('validates scheduled payment with invalid gas token', async function () {
    let subject = await getContainer().lookup('scheduled-payment-validator');

    const scheduledPayment: Partial<ScheduledPayment> = {
      chainId: 1, //Mainnet
      gasTokenAddress: '0x36F2319Fbb44772e0ED58fB7c99cf8da59e2b5BA',
    };

    let errors = await subject.validate(scheduledPayment);
    expect(errors.gasTokenAddress).deep.equal([
      'gas token is not supported, supported gas token: 0x52031d287Bb58E26A379A7Fec2c84acB54f54fe3, 0x26F2319Fbb44772e0ED58fB7c99cf8da59e2b5BE',
    ]);
  });
});
