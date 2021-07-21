import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, fillIn, render, typeIn } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import { toBN, toWei } from 'web3-utils';

module(
  'Integration | Component | card-pay/withdrawal-workflow/transaction-amount',
  async function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(async function () {
      let layer2Service = this.owner.lookup('service:layer2-network');
      let layer2Strategy = layer2Service.strategy as Layer2TestWeb3Strategy;

      // Simulate being connected on layer 2 -- prereq to converting to USD
      let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
      layer2Strategy.test__simulateAccountsChanged([layer2AccountAddress]);

      const startDaiAmountString = '100.1111111111111111';
      let startDaiAmount = toWei(startDaiAmountString);

      const session = new WorkflowSession();
      session.update('withdrawalToken', 'DAI.CPXD');

      layer2Strategy.test__simulateBalances({
        defaultToken: toBN(startDaiAmount),
        dai: toBN(startDaiAmount),
        card: toBN('0'),
      });

      this.setProperties({
        session,
      });

      await render(hbs`
        <CardPay::WithdrawalWorkflow::TransactionAmount
          @workflowSession={{this.session}}
          @onComplete={{noop}}
          @onIncomplete={{noop}}
        />
      `);
    });

    test('the amount is marked invalid when a value is entered and then cleared', async function (assert) {
      await fillIn('input', '50');
      await fillIn('input', '');
      assert.dom('input').hasAria('invalid', 'true');
      assert
        .dom('[data-test-boxel-input-error-message]')
        .containsText('This field is required');
    });

    test('the amount is marked invalid when the field loses focus', async function (assert) {
      await click('input');
      await click('[data-test-balance-view-summary]');
      assert.dom('input').hasAria('invalid', 'true');
      assert
        .dom('[data-test-boxel-input-error-message]')
        .containsText('This field is required');
    });

    test('it accepts a well-formatted value that is less than or equal to the balance', async function (assert) {
      await fillIn('input', '50');
      assert.dom('input').hasValue('50');
      assert.dom('input').doesNotHaveAria('invalid', 'true');
      assert.dom('[data-test-boxel-input-error-message]').doesNotExist();

      await fillIn('input', '50.5');
      assert.dom('input').hasValue('50.5');
      assert.dom('input').doesNotHaveAria('invalid', 'true');
      assert.dom('[data-test-boxel-input-error-message]').doesNotExist();

      await fillIn('input', '100');
      assert.dom('input').hasValue('100');
      assert.dom('input').doesNotHaveAria('invalid', 'true');
      assert.dom('[data-test-boxel-input-error-message]').doesNotExist();
    });

    test('it rejects a well-formatted value this is greater than the balance', async function (assert) {
      await fillIn('input', '150');
      assert.dom('input').hasValue('150');
      assert.dom('input').hasAria('invalid', 'true');
      assert
        .dom('[data-test-boxel-input-error-message]')
        .containsText('Insufficient balance in your account');

      await fillIn('input', '100.2');
      assert.dom('input').hasValue('100.2');
      assert.dom('input').hasAria('invalid', 'true');
      assert
        .dom('[data-test-boxel-input-error-message]')
        .containsText('Insufficient balance in your account');
    });

    test('it strips whitespace from the beginning and end', async function (assert) {
      await fillIn('input', ' 11 ');
      assert.dom('input').hasValue('11');
      assert.dom('input').doesNotHaveAria('invalid', 'true');
      assert.dom('[data-test-boxel-input-error-message]').doesNotExist();
    });

    test('it rejects a well-formatted value that exceeds 18 decimal places', async function (assert) {
      await fillIn('input', '1.1234567890123456789');
      assert.dom('input').hasValue('1.1234567890123456789');
      assert.dom('input').hasAria('invalid', 'true');
      assert
        .dom('[data-test-boxel-input-error-message]')
        .containsText('Amount must have less than 18 decimal points');
    });

    test('it ignores a minus sign', async function (assert) {
      await typeIn('input', '-1.5');
      assert.dom('input').hasValue('1.5');
      assert.dom('input').doesNotHaveAria('invalid', 'true');
      assert.dom('[data-test-boxel-input-error-message]').doesNotExist();
    });

    test('it ignores non-number characters', async function (assert) {
      await typeIn('input', '11x');
      assert.dom('input').hasValue('11');
      assert.dom('input').doesNotHaveAria('invalid', 'true');
      assert.dom('[data-test-boxel-input-error-message]').doesNotExist();
    });
  }
);
