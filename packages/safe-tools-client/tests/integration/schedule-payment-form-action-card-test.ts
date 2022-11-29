import { click, fillIn, render, TestContext } from '@ember/test-helpers';
import { keyDown } from 'ember-keyboard/test-support/test-helpers';
import { selectChoose } from 'ember-power-select/test-support';
import { setupRenderingTest } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';
import { module, test } from 'qunit';

import { exampleGasTokens } from '../support/tokens';

const EXAMPLE_RECIPIENT = '0xb794f5ea0ba39494ce839613fffba74279579268';

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

      // choose payment date of tomorrow
      await click('[data-test-boxel-input-date-trigger]');
      await keyDown('ArrowRight');
      await keyDown('Enter');
      await keyDown('Escape');

      // choose payment time of 9AM
      await click('[data-test-boxel-input-time-trigger]');
      await keyDown('9');
      await keyDown(':');
      await keyDown('0');
      await keyDown('A');
      await keyDown('Enter');

      assert
        .dom('[data-test-schedule-payment-form-submit-button]')
        .isDisabled();

      await fillIn('[data-test-recipient-address-input]', EXAMPLE_RECIPIENT);

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

      await fillIn('[data-test-recipient-address-input]', 'Not an address');
      assert
        .dom('[data-test-schedule-payment-form-submit-button]')
        .isDisabled();
    });

    // TODO: assert state for no network selected/connected
    // TODO: assert state for no safe present
  }
);
