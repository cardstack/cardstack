import { click, fillIn, render, TestContext } from '@ember/test-helpers';
import { format, subDays, addMonths, addHours, subHours } from 'date-fns';
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

    test(`it disables dates in the past (one-time payment)`, async function (assert) {
      await render(hbs`
        <SchedulePaymentFormActionCard />
      `);
      const now = new Date();
      const yesterday = subDays(now, 1);
      await click(`[data-test-payment-type="one-time"]`);
      await click(`[data-test-input-payment-date]`);
      assert.dom(`[data-date="${format(now, 'yyyy-MM-dd')}"]`).isEnabled();
      assert
        .dom(`[data-date="${format(yesterday, 'yyyy-MM-dd')}"]`)
        .isDisabled();
    });

    test(`it disables times before one hour from now (one-time payment)`, async function (assert) {
      await render(hbs`
        <SchedulePaymentFormActionCard />
      `);
      const now = new Date();
      const nextOneHour = addHours(now, 1);
      await click(`[data-test-payment-type="one-time"]`);
      await click(`[data-test-input-specific-payment-time]`);

      assert
        .dom(
          `[data-test-boxel-hour-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="${format(
            nextOneHour,
            'h'
          )}"]`
        )
        .exists();

      //No disabled times if the nextOneHour is 00:00 or 12:00
      if (nextOneHour.getHours() !== 0 && nextOneHour.getHours() !== 12) {
        assert
          .dom(
            `[data-test-boxel-hour-menu] .boxel-menu__item--disabled [data-test-boxel-menu-item-text="${format(
              subHours(nextOneHour, 1),
              'h'
            )}"]`
          )
          .exists();
      }
    });

    test(`it disables dates before the payment day of month`, async function (assert) {
      await render(hbs`
        <SchedulePaymentFormActionCard />
      `);
      const paymentDayOfMonth = 1;
      const now = new Date();
      let minMonthlyUntil;
      if (paymentDayOfMonth < now.getDate()) {
        minMonthlyUntil = new Date(
          addMonths(now, 1).setDate(paymentDayOfMonth)
        );
      } else {
        minMonthlyUntil = now;
      }

      await click(`[data-test-payment-type="monthly"]`);
      await click(`[data-test-input-recurring-day-of-month]`);
      await click(`[data-option-index="${paymentDayOfMonth - 1}"]`);
      await click(`[data-test-input-recurring-until]`);

      while (
        this.element
          .querySelector('.ember-power-calendar-nav-title')
          ?.textContent?.trim() !== `${format(minMonthlyUntil, 'MMMM yyyy')}`
      ) {
        await click(`.ember-power-calendar-nav-control--previous`);
      }
      assert
        .dom(`[data-date="${format(minMonthlyUntil, 'yyyy-MM-dd')}"]`)
        .isEnabled();

      if (minMonthlyUntil.getDate() === 1) {
        await click(`.ember-power-calendar-nav-control--previous`);
      }

      const disabledDate = subDays(minMonthlyUntil, 1);
      assert
        .dom(`[data-date="${format(disabledDate, 'yyyy-MM-dd')}"]`)
        .isDisabled();
    });

    // TODO: assert state for no network selected/connected
    // TODO: assert state for no safe present
  }
);
