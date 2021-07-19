import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { fillIn, render, typeIn } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

import { toBN, toWei } from 'web3-utils';

module('Integration | Component | card-pay/amount-input', function (hooks) {
  setupRenderingTest(hooks);

  let enteredValue: string;
  let valueIsValid: boolean;

  hooks.beforeEach(async function () {
    this.set('onInputAmount', function (value: string, isValid: boolean) {
      enteredValue = value;
      valueIsValid = isValid;
    });

    this.set('tokenBalance', toBN(toWei('100')));

    await render(hbs`
      <CardPay::AmountInput
        @label="Amount to transform"
        @tokenSymbol="DAI.CPXD"
        @tokenBalance={{this.tokenBalance}}
        @onInputAmount={{this.onInputAmount}}
      />
    `);
  });

  test('It accepts various presentational options', async function (assert) {
    assert
      .dom('[data-test-boxel-edit-field-label]')
      .containsText('Amount to transform');

    assert.dom('[data-test-currency-icon-name="dai-token"]').exists();

    assert
      .dom('[data-test-amount-input-currency-label]')
      .containsText('DAI.CPXD');
  });

  test('it calls the onInputAmount callback on render with an empty string that is marked invalid in the callback but not on the element', async function (assert) {
    assert.equal(enteredValue, '');
    assert.notOk(valueIsValid);
    assert.dom('input').doesNotHaveAria('invalid', 'true');
  });

  test('the element is marked invalid when a value is entered and then cleared', async function (assert) {
    await fillIn('input', '50');
    await fillIn('input', '');
    assert.notOk(valueIsValid);
    assert.dom('input').hasAria('invalid', 'true');
  });

  test('it accepts a well-formatted value that is less than or equal to the balance', async function (assert) {
    await fillIn('input', '50');
    assert.equal(enteredValue, '50');
    assert.ok(valueIsValid);
    assert.dom('input').doesNotHaveAria('invalid', 'true');
    assert.dom('[data-test-boxel-input-error-message]').doesNotExist();

    await fillIn('input', '50.5');
    assert.equal(enteredValue, '50.5');
    assert.ok(valueIsValid);
    assert.dom('input').doesNotHaveAria('invalid', 'true');
    assert.dom('[data-test-boxel-input-error-message]').doesNotExist();

    await fillIn('input', '100');
    assert.equal(enteredValue, '100');
    assert.ok(valueIsValid);
    assert.dom('input').doesNotHaveAria('invalid', 'true');
    assert.dom('[data-test-boxel-input-error-message]').doesNotExist();
  });

  test('it rejects a well-formatted value this is greater than the balance', async function (assert) {
    await fillIn('input', '150');
    assert.equal(enteredValue, '150');
    assert.notOk(valueIsValid);
    assert.dom('input').hasAria('invalid', 'true');
    assert
      .dom('[data-test-boxel-input-error-message]')
      .containsText('must not exceed balance');

    await fillIn('input', '100.1');
    assert.equal(enteredValue, '100.1');
    assert.notOk(valueIsValid);
    assert.dom('input').hasAria('invalid', 'true');
    assert
      .dom('[data-test-boxel-input-error-message]')
      .containsText('must not exceed balance');
  });

  test('it strips whitespace from the beginning and end', async function (assert) {
    await fillIn('input', ' 11 ');
    assert.equal(enteredValue, '11');
    assert.ok(valueIsValid);
    assert.dom('input').doesNotHaveAria('invalid', 'true');
    assert.dom('[data-test-boxel-input-error-message]').doesNotExist();
  });

  test('it truncates a well-formatted value that exceeds 18 decimal places', async function (assert) {
    await fillIn('input', '1.1234567890123456789');
    assert.equal(enteredValue, '1.123456789012345678');
    assert.notOk(valueIsValid);
    assert.dom('input').hasAria('invalid', 'true');
    assert
      .dom('[data-test-boxel-input-error-message]')
      .containsText('must not exceed eighteen decimal places');
  });

  test('it ignores a minus sign', async function (assert) {
    await typeIn('input', '-1.5');
    assert.equal(enteredValue, '1.5');
    assert.ok(valueIsValid);
    assert.dom('input').doesNotHaveAria('invalid', 'true');
    assert.dom('[data-test-boxel-input-error-message]').doesNotExist();
  });

  test('it ignores non-number characters', async function (assert) {
    await typeIn('input', '11x');
    assert.dom('input').hasValue('11');
    assert.equal(enteredValue, '11');
    assert.ok(valueIsValid);
    assert.dom('input').doesNotHaveAria('invalid', 'true');
    assert.dom('[data-test-boxel-input-error-message]').doesNotExist();
  });
});
