import { click, fillIn, render, TestContext } from '@ember/test-helpers';
import { selectChoose } from 'ember-power-select/test-support';
import { setupRenderingTest } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';
import { module, test } from 'qunit';

import { exampleGasTokens } from '../support/tokens';
import {
  chooseTime,
  chooseTomorrow,
  EXAMPLE_PAYEE,
} from '../support/ui-test-helpers';

module(
  'Integration | Component | schedule-payment-form-action-card',
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function (this: TestContext) {
      const tokensService = this.owner.lookup('service:tokens');
      tokensService.stubGasTokens(exampleGasTokens);
    });

    test('it initializes the transaction token to undefined', async function (assert) {
      await render(hbs`
        <SchedulePaymentFormActionCard />
      `);
      assert
        .dom(
          '.boxel-input-selectable-token-amount [data-test-boxel-input-group-select-accessory-trigger]'
        )
        .containsText('Choose token');
    });

    test('it shows tokens from the tokens service', async function (assert) {
      await render(hbs`
        <SchedulePaymentFormActionCard />
      `);
      await click(
        '.boxel-input-selectable-token-amount [data-test-boxel-input-group-select-accessory-trigger]'
      );
      assert
        .dom('.boxel-input-selectable-token-amount__dropdown')
        .containsText('USDC');
      assert
        .dom('.boxel-input-selectable-token-amount__dropdown')
        .containsText('DAI');
    });

    test('it only enables the primary button when the form is valid', async function (assert) {
      await render(hbs`
        <SchedulePaymentFormActionCard />
      `);
      assert
        .dom('[data-test-schedule-payment-form-submit-button]')
        .isDisabled();

      await click('[data-test-payment-type="one-time"]');

      assert
        .dom('[data-test-schedule-payment-form-submit-button]')
        .isDisabled();

      await chooseTomorrow('[data-test-boxel-input-date-trigger]');

      await chooseTime('[data-test-boxel-input-time-trigger]', 9, 0, 'am');

      assert
        .dom('[data-test-schedule-payment-form-submit-button]')
        .isDisabled();

      await fillIn('[data-test-payee-address-input]', EXAMPLE_PAYEE);

      assert
        .dom('[data-test-schedule-payment-form-submit-button]')
        .isDisabled();

      await fillIn('[data-test-amount-input] input', '15.0');

      assert
        .dom('[data-test-schedule-payment-form-submit-button]')
        .isDisabled();

      // Choose USDC for the transaction token
      await selectChoose(
        '[data-test-amount-input] [data-test-boxel-input-group-select-accessory-trigger]',
        'USDC'
      );

      assert
        .dom('[data-test-schedule-payment-form-submit-button]')
        .isDisabled();

      // Choose USDC for the gas token
      await selectChoose('[data-test-gas-token-select]', 'USDC');

      assert
        .dom('[data-test-schedule-payment-form-submit-button]')
        .isDisabled();

      await click(
        '[data-test-max-gas-toggle] [data-toggle-group-option="normal"]'
      );

      assert.dom('[data-test-schedule-payment-form-submit-button]').isEnabled();

      await fillIn('[data-test-payee-address-input]', 'Not an address');
      assert
        .dom('[data-test-schedule-payment-form-submit-button]')
        .isDisabled();
    });

    test('it can switch to one-time payment once switches to monthly', async function (assert) {
      await render(hbs`
        <SchedulePaymentFormActionCard />
      `);
      assert.dom('[data-test-payment-date]').isNotVisible();
      assert.dom('[data-test-specific-payment-time]').isNotVisible();
      assert.dom('[data-test-recurring-day-of-month]').isNotVisible();
      assert.dom('[data-test-recurring-until]').isNotVisible();

      let paymentType = 'monthly';
      for (let i = 1; i <= 4; i++) {
        await click(`[data-test-payment-type="${paymentType}"]`);
        if (paymentType === 'monthly') {
          assert.dom('[data-test-payment-date]').isNotVisible();
          assert.dom('[data-test-specific-payment-time]').isNotVisible();
          assert.dom('[data-test-recurring-day-of-month]').isVisible();
          assert.dom('[data-test-recurring-until]').isVisible();

          paymentType = 'one-time';
        } else {
          assert.dom('[data-test-payment-date]').isVisible();
          assert.dom('[data-test-specific-payment-time]').isVisible();
          assert.dom('[data-test-recurring-day-of-month]').isNotVisible();
          assert.dom('[data-test-recurring-until]').isNotVisible();

          paymentType = 'monthly';
        }
      }
    });

    // TODO: assert state for no network selected/connected
    // TODO: assert state for no safe present
  }
);
