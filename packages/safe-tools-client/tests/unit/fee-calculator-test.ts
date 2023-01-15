import { SelectableToken } from '@cardstack/boxel/components/boxel/input/selectable-token';
import FeeCalculator, {
  CurrentFees,
} from '@cardstack/safe-tools-client/components/schedule-payment-form-action-card/fee-calculator';
import { ConfiguredScheduledPaymentFees } from '@cardstack/safe-tools-client/services/scheduled-payment-sdk';
import TokenQuantity from '@cardstack/safe-tools-client/utils/token-quantity';
import { BigNumber } from 'ethers';
import { module, test } from 'qunit';

module('Unit | FeeCalculator', (hooks) => {
  let feeCalculator: FeeCalculator;
  let configuredFees: ConfiguredScheduledPaymentFees;
  let paymentTokenQuantity: TokenQuantity;
  let gasToken: SelectableToken;
  let paymentToken: SelectableToken;

  hooks.beforeEach(() => {
    configuredFees = {
      fixedUSD: 0.75,
      percentage: 1.5,
    };
    paymentToken = {
      address: '0x2345678901',
      symbol: 'PAYA',
      name: 'Example Token A',
      decimals: 6,
    };
    paymentTokenQuantity = new TokenQuantity(
      paymentToken,
      BigNumber.from(200000000)
    );
    gasToken = {
      address: '0x1234567890',
      symbol: 'GASA',
      name: 'Example Token B',
      decimals: 18,
    };
    feeCalculator = new FeeCalculator(
      configuredFees,
      paymentTokenQuantity,
      gasToken,
      BigNumber.from('200000000000000000000')
    );
  });

  test('should calculate the correct fixed fee', function (assert) {
    const fixedFeeResult = feeCalculator.calculateFee().fixedFee;
    assert.ok(fixedFeeResult);
    assert.strictEqual((fixedFeeResult as TokenQuantity).token, gasToken);
    assert.strictEqual(
      (fixedFeeResult as TokenQuantity).count.toString(),
      '150000000000000000000'
    );
  });

  test('should calculate the correct variable fee', function (assert) {
    const variableFeeResult = feeCalculator.calculateFee().variableFee;
    assert.ok(variableFeeResult);
    assert.strictEqual(
      (variableFeeResult as TokenQuantity).token,
      paymentToken
    );
    assert.strictEqual(
      (variableFeeResult as TokenQuantity).count.toString(),
      '3000000'
    );
  });

  test('passes through configured fees', function (assert) {
    const expectedFees: CurrentFees = {
      fixedFeeInUSD: 0.75,
      fixedFee: new TokenQuantity(
        gasToken,
        BigNumber.from('150000000000000000000')
      ),
      percentageFee: 1.5,
      variableFee: new TokenQuantity(paymentToken, BigNumber.from('3000000')),
    };
    assert.deepEqual(feeCalculator.calculateFee(), expectedFees);
  });
});
