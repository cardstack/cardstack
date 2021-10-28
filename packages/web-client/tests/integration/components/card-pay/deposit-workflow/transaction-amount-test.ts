import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import {
  render,
  fillIn,
  typeIn,
  click,
  settled,
  waitFor,
} from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer1TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer1';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { WorkflowSession } from '@cardstack/web-client/models/workflow';
import BN from 'bn.js';
import { toWei } from 'web3-utils';
import sinon from 'sinon';

let layer1Service: Layer1TestWeb3Strategy;
let session: WorkflowSession;

module(
  'Integration | Component | card-pay/deposit-workflow/transaction-amount',
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(async function () {
      let layer2Service = this.owner.lookup('service:layer2-network');
      let layer2Strategy = layer2Service.strategy as Layer2TestWeb3Strategy;

      // Simulate being connected on layer 2 -- prereq to converting to USD
      let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
      layer2Strategy.test__simulateAccountsChanged([layer2AccountAddress]);

      session = new WorkflowSession();
      session.setValue('depositSourceToken', 'DAI');
      layer1Service = this.owner.lookup('service:layer1-network').strategy;

      const startDaiAmountString = '5.111111111111111110';
      const startDaiAmount = toWei(startDaiAmountString);

      layer1Service.test__simulateBalances({
        defaultToken: new BN('0'),
        dai: new BN(startDaiAmount),
        card: new BN('0'),
      });

      this.setProperties({
        session,
      });
    });

    test('it can go through with unlock and deposit', async function (assert) {
      let completed = false;
      this.set('onComplete', () => {
        completed = true;
      });
      await render(hbs`
      <CardPay::DepositWorkflow::TransactionAmount
        @workflowSession={{this.session}}
        @onComplete={{this.onComplete}}
        @onIncomplete={{noop}}
      />
    `);

      const daiToSend = '5';
      // const daiToSendInWei = '5000000000000000000';

      await fillIn('[data-test-token-amount-input]', daiToSend);
      assert.dom('[data-test-deposit-button]').isDisabled();
      assert.dom('[data-test-unlock-button]').isNotDisabled();

      await click('[data-test-unlock-button]');
      layer1Service.test__simulateUnlockTxnHash();
      await waitFor('[data-test-unlock-etherscan-button]');

      assert
        .dom('[data-test-unlock-etherscan-button]')
        .containsText('View on Etherscan')
        .hasAttribute('href', /.+/);

      layer1Service.test__simulateUnlock();
      await settled();

      assert.dom('[data-test-deposit-button]').isEnabled();

      await click('[data-test-deposit-button]');

      assert.dom('[data-test-deposit-button]').containsText('Depositing');

      layer1Service.test__simulateDepositTxnHash();
      await waitFor('[data-test-deposit-etherscan-button]');

      assert
        .dom('[data-test-deposit-etherscan-button]')
        .containsText('View on Etherscan')
        .hasAttribute('href', /.+/);

      layer1Service.test__simulateDeposit();
      await settled();

      assert
        .dom('[data-test-deposit-success-message]')
        .containsText('Deposited');
      assert.ok(completed);
    });

    test('its deposit step can be canceled if there is no deposit transaction hash', async function (assert) {
      session.setValue('unlockTxnHash', 'unlockTokensTxnHash');
      session.setValue('depositSourceToken', 'DAI');
      session.setValue('depositedAmount', new BN(toWei('5')));

      await render(hbs`
      <CardPay::DepositWorkflow::TransactionAmount
        @workflowSession={{this.session}}
        @onComplete={{noop}}
        @onIncomplete={{noop}}
      />
    `);

      await layer1Service.test__simulateUnlock();

      await click('[data-test-deposit-button]');
      assert.dom('[data-test-deposit-button]').containsText('Depositing');

      assert.dom('[data-test-deposit-cancel-button]').isVisible();
      assert.dom('[data-test-deposit-cancel-button]').isEnabled();

      await click('[data-test-deposit-cancel-button]');

      assert.dom('[data-test-deposit-button]').containsText('Deposit');
      assert.dom('[data-test-deposit-button]').isEnabled();
    });

    test('its deposit step can not be canceled if there is a deposit transaction hash', async function (assert) {
      session.setValue('unlockTxnHash', 'unlockTokensTxnHash');
      session.setValue('depositSourceToken', 'DAI');
      session.setValue('depositedAmount', new BN(toWei('5')));

      await render(hbs`
      <CardPay::DepositWorkflow::TransactionAmount
        @workflowSession={{this.session}}
        @onComplete={{noop}}
        @onIncomplete={{noop}}
      />
    `);

      await layer1Service.test__simulateUnlock();

      session.setValue('relayTokensTxnHash', 'relayTokensTxnHash');

      await click('[data-test-deposit-button]');

      assert.dom('[data-test-deposit-button]').containsText('Depositing');
      assert.dom('[data-test-deposit-cancel-button]').doesNotExist();
    });

    test('It disables the unlock button when amount entered is more than balance (18-decimal floating point)', async function (assert) {
      const daiInBalance = '5.111111111111111110';
      const moreDaiThanBalance = '5.111111111111111111';

      await render(hbs`
      <CardPay::DepositWorkflow::TransactionAmount
        @workflowSession={{this.session}}
        @onComplete={{noop}}
        @onIncomplete={{noop}}
      />
    `);

      assert.dom('[data-test-unlock-button]').isDisabled();
      await fillIn('[data-test-token-amount-input]', moreDaiThanBalance);
      assert.dom('[data-test-unlock-button]').isDisabled();
      assert
        .dom('[data-test-boxel-input-error-message]')
        .containsText('Insufficient balance in your account');

      await fillIn('[data-test-token-amount-input]', daiInBalance);
      assert.dom('[data-test-unlock-button]').isNotDisabled();
    });

    test('It accurately sends the amount to be handled by layer 1 (18-decimal floating point)', async function (assert) {
      const daiToSend = '5.111111111111111110';
      const daiToSendInWei = '5111111111111111110';

      await render(hbs`
      <CardPay::DepositWorkflow::TransactionAmount
        @workflowSession={{this.session}}
        @onComplete={{noop}}
        @onIncomplete={{noop}}
      />
    `);

      let approveSpy = sinon.spy(layer1Service, 'approve');

      await fillIn('[data-test-token-amount-input]', daiToSend);
      assert.dom('[data-test-unlock-button]').isNotDisabled();

      await click('[data-test-unlock-button]');

      assert.ok(
        approveSpy.calledWith(new BN(daiToSendInWei), 'DAI'),
        'The amount that the approve call is made with matches the amount shown in the UI'
      );
    });

    test('It does not accept invalid values and ignores invalid characters typed in', async function (assert) {
      const startDaiString = '55.111111111111111111';
      const validAmount = '2';
      const invalidDai1 =
        '4.1111111111111111112'; /* more than 18 decimal places */
      const invalidDai2 = '1  1'; /* has space */
      const invalidDai3 = '  1'; /* has space */
      const invalidDai4 = '12/'; /* invalid char */
      let startDaiAmount = toWei(startDaiString);

      await render(hbs`
      <CardPay::DepositWorkflow::TransactionAmount
        @workflowSession={{this.session}}
        @onComplete={{noop}}
        @onIncomplete={{noop}}
      />
    `);

      layer1Service.test__simulateBalances({
        defaultToken: new BN('0'),
        dai: new BN(startDaiAmount),
        card: new BN('0'),
      });

      await settled();

      assert.dom('[data-test-token-amount-input]').hasValue('');
      assert.dom('[data-test-unlock-button]').isDisabled();

      await fillIn('[data-test-token-amount-input]', invalidDai1);
      assert.dom('[data-test-token-amount-input]').hasValue(invalidDai1);
      assert.dom('[data-test-unlock-button]').isDisabled();

      await fillIn('[data-test-token-amount-input]', validAmount);
      assert.dom('[data-test-token-amount-input]').hasValue(validAmount);
      assert.dom('[data-test-unlock-button]').isNotDisabled();

      await fillIn('[data-test-token-amount-input]', invalidDai2);
      assert.dom('[data-test-token-amount-input]').hasValue(validAmount);
      assert.dom('[data-test-unlock-button]').isNotDisabled();

      await fillIn('[data-test-token-amount-input]', '');
      assert.dom('[data-test-token-amount-input]').hasValue('');
      assert.dom('[data-test-unlock-button]').isDisabled();

      await typeIn('[data-test-token-amount-input]', invalidDai2);
      assert.dom('[data-test-token-amount-input]').hasValue('11');
      assert.dom('[data-test-unlock-button]').isNotDisabled();

      await fillIn('[data-test-token-amount-input]', '');
      await typeIn('[data-test-token-amount-input]', invalidDai3);
      assert.dom('[data-test-token-amount-input]').hasValue('1');
      assert.dom('[data-test-unlock-button]').isNotDisabled();

      await fillIn('[data-test-token-amount-input]', '');
      await typeIn('[data-test-token-amount-input]', invalidDai4);
      assert.dom('[data-test-token-amount-input]').hasValue('12');
      assert.dom('[data-test-unlock-button]').isNotDisabled();

      await fillIn('[data-test-token-amount-input]', startDaiString);
      assert.dom('[data-test-token-amount-input]').hasValue(startDaiString);
      assert.dom('[data-test-unlock-button]').isNotDisabled();
    });

    test('it rejects a value of zero', async function (assert) {
      await render(hbs`
      <CardPay::DepositWorkflow::TransactionAmount
        @workflowSession={{this.session}}
        @onComplete={{noop}}
        @onIncomplete={{noop}}
      />
    `);

      await fillIn('input', '0');
      assert.dom('input').hasAria('invalid', 'true');
      assert
        .dom('[data-test-boxel-input-error-message]')
        .containsText('Amount must be above 0.00 DAI');
    });
  }
);
