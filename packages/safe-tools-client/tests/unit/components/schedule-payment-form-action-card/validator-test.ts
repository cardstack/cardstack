import Validator, {
  ValidatableForm,
} from '@cardstack/safe-tools-client/components/schedule-payment-form-action-card/validator';
import { EXAMPLE_RECIPIENT } from '@cardstack/safe-tools-client/tests/support/ui-test-helpers';
import { setupTest } from 'ember-qunit';
import { module, test } from 'qunit';

module('Unit | SchedulePaymentFormActionCard Validator', function (hooks) {
  setupTest(hooks);

  let exampleForm: ValidatableForm;
  hooks.beforeEach(function () {
    exampleForm = {
      selectedPaymentType: 'one-time',
      paymentDate: new Date(2050, 12, 0, 9, 30, 0),
      paymentDayOfMonth: undefined,
      monthlyUntil: undefined,
      recipientAddress: EXAMPLE_RECIPIENT,
      paymentAmount: '1.5',
      paymentToken: {
        name: 'Cardstack',
        logoURI: 'card',
        symbol: 'CARD',
        address: '0x954b890704693af242613edEf1B603825afcD708',
      },
      selectedGasToken: {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        name: 'USD Coin',
        symbol: 'USDC',
        logoURI:
          'https://assets-cdn.trustwallet.com/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
      },
      maxGasFee: 'normal',
    };
  });

  test('is valid when everything is set', function (assert) {
    const subject = new Validator(exampleForm);
    assert.true(subject.isValid);
  });

  test('is not valid when paymentType is unset', function (assert) {
    exampleForm.selectedPaymentType = undefined;
    const subject = new Validator(exampleForm);
    assert.false(subject.isValid);
  });

  test('is not valid when paymentType is one-time but date and time are unset', function (assert) {
    exampleForm.selectedPaymentType = 'one-time';
    exampleForm.paymentDate = undefined;
    const subject = new Validator(exampleForm);
    assert.false(subject.isValid);
  });

  test('is not valid when paymentType is monthly but day number is unset', function (assert) {
    exampleForm.selectedPaymentType = 'monthly';
    exampleForm.paymentDayOfMonth = undefined;
    const subject = new Validator(exampleForm);
    assert.false(subject.isValid);
  });

  test('is not valid when paymentType is monthly but until date is unset', function (assert) {
    exampleForm.selectedPaymentType = 'monthly';
    exampleForm.monthlyUntil = undefined;
    const subject = new Validator(exampleForm);
    assert.false(subject.isValid);
  });

  test('is not valid when recipient is missing', function (assert) {
    exampleForm.recipientAddress = '';
    const subject = new Validator(exampleForm);
    assert.false(subject.isValid);
  });

  test('is not valid when recipient is not an address', function (assert) {
    exampleForm.recipientAddress = 'hello';
    const subject = new Validator(exampleForm);
    assert.false(subject.isValid);
  });

  test('is not valid when paymentAmount is unset', function (assert) {
    exampleForm.paymentAmount = '';
    const subject = new Validator(exampleForm);
    assert.false(subject.isValid);
  });

  test('is not valid when paymentAmount is not a number', function (assert) {
    exampleForm.paymentAmount = 'my left foot';
    const subject = new Validator(exampleForm);
    assert.false(subject.isValid);
  });

  test('is not valid when paymentToken is unset', function (assert) {
    exampleForm.paymentToken = undefined;
    const subject = new Validator(exampleForm);
    assert.false(subject.isValid);
  });

  test('is not valid when selectedGasToken is unset', function (assert) {
    exampleForm.selectedGasToken = undefined;
    const subject = new Validator(exampleForm);
    assert.false(subject.isValid);
  });

  test('is not valid when maxGasFee is unset', function (assert) {
    exampleForm.maxGasFee = undefined;
    const subject = new Validator(exampleForm);
    assert.false(subject.isValid);
  });

  // is not valid when paymentType is one-time but date and time are in the past
});
