import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, fillIn, typeIn, click } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer1TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer1';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import BN from 'bn.js';
import { toBN, toWei } from 'web3-utils';
import sinon from 'sinon';

module(
  'Integration | Component | card-pay/deposit-workflow/transaction-amount',
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function () {
      let layer2Service = this.owner.lookup('service:layer2-network');
      let layer2Strategy = layer2Service.strategy as Layer2TestWeb3Strategy;

      // Simulate being connected on layer 2 -- prereq to converting to USD
      let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
      layer2Strategy.test__simulateAccountsChanged([layer2AccountAddress]);
    });

    test('It disables the unlock button when amount entered is more than balance (18-decimal floating point)', async function (assert) {
      const startDaiAmountString = '5.111111111111111110';
      const daiToSend = '5.111111111111111111';
      let startDaiAmount = toWei(startDaiAmountString);

      const session = new WorkflowSession();
      session.update('depositSourceToken', 'DAI');
      const layer1Service = this.owner.lookup('service:layer1-network')
        .strategy as Layer1TestWeb3Strategy;

      layer1Service.test__simulateBalances({
        defaultToken: toBN('0'),
        dai: toBN(startDaiAmount),
        card: toBN('0'),
      });

      this.setProperties({
        session,
      });

      await render(hbs`
          <CardPay::DepositWorkflow::TransactionAmount
            @workflowSession={{this.session}}
            @onComplete={{noop}}
            @onIncomplete={{noop}}
          />
        `);

      assert.dom('[data-test-unlock-button]').isDisabled();
      await fillIn('[data-test-token-amount-input]', daiToSend);
      assert.dom('[data-test-unlock-button]').isDisabled();
      await fillIn('[data-test-token-amount-input]', startDaiAmountString);
      assert.dom('[data-test-unlock-button]').isNotDisabled();
    });

    test('It accurately sends the amount to be handled by layer 1 (18-decimal floating point)', async function (assert) {
      const daiToSend = '5.111111111111111111';
      const daiToSendInWei = '5111111111111111111';
      let startDaiAmount = toWei('10');

      const session = new WorkflowSession();
      session.update('depositSourceToken', 'DAI');
      const layer1Service = this.owner.lookup('service:layer1-network')
        .strategy as Layer1TestWeb3Strategy;

      layer1Service.test__simulateBalances({
        defaultToken: toBN('0'),
        dai: toBN(startDaiAmount),
        card: toBN('0'),
      });

      let approveSpy = sinon.spy(layer1Service, 'approve');

      this.setProperties({
        session,
      });

      await render(hbs`
          <CardPay::DepositWorkflow::TransactionAmount
            @workflowSession={{this.session}}
            @onComplete={{noop}}
            @onIncomplete={{noop}}
          />
        `);

      await fillIn('[data-test-token-amount-input]', daiToSend);
      assert.dom('[data-test-unlock-button]').isNotDisabled();

      await click('[data-test-unlock-button]');

      assert.ok(
        approveSpy.calledOnceWith(new BN(daiToSendInWei), 'DAI'),
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

      const session = new WorkflowSession();
      session.update('depositSourceToken', 'DAI');
      const layer1Service = this.owner.lookup('service:layer1-network')
        .strategy as Layer1TestWeb3Strategy;

      layer1Service.test__simulateBalances({
        defaultToken: toBN('0'),
        dai: toBN(startDaiAmount),
        card: toBN('0'),
      });

      this.setProperties({
        session,
      });

      await render(hbs`
          <CardPay::DepositWorkflow::TransactionAmount
            @workflowSession={{this.session}}
            @onComplete={{noop}}
            @onIncomplete={{noop}}
          />
        `);

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
  }
);
