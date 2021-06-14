import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, fillIn, typeIn, click } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { TransactionReceipt } from 'web3-core';
import Layer1TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer1';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import BN from 'bn.js';
import { toBN, toWei } from 'web3-utils';
import { defer } from 'rsvp';
import RSVP from 'rsvp';

module('Integration | Component | transaction-amount', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {
    let layer2Service = this.owner.lookup('service:layer2-network');
    let layer2Strategy = layer2Service.strategy as Layer2TestWeb3Strategy;

    // Simulate being connected on layer 2 -- prereq to converting to USD
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer2Strategy.test__simulateAccountsChanged([layer2AccountAddress]);
  });

  const hijackApprove = (
    service: Layer1TestWeb3Strategy,
    fn: (_amountInWei: BN) => void
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    service.approve = function approve(_amountInWei: BN, _token: string) {
      fn(_amountInWei);
      let resolved = defer() as RSVP.Deferred<TransactionReceipt>;
      resolved.resolve();
      return resolved.promise;
    };
  };

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
    await fillIn('[data-test-deposit-amount-input]', daiToSend);
    assert.dom('[data-test-unlock-button]').isDisabled();
    await fillIn('[data-test-deposit-amount-input]', startDaiAmountString);
    assert.dom('[data-test-unlock-button]').isNotDisabled();
  });

  test('It accurately sends the amount to be handled by layer 1 (18-decimal floating point)', async function (assert) {
    const daiToSend = '5.111111111111111111';
    const daiToSendInWei = '5111111111111111111';
    let startDaiAmount = toWei('10');
    let weiSentToApprove = toBN('-1');

    const session = new WorkflowSession();
    session.update('depositSourceToken', 'DAI');
    const layer1Service = this.owner.lookup('service:layer1-network')
      .strategy as Layer1TestWeb3Strategy;

    layer1Service.test__simulateBalances({
      defaultToken: toBN('0'),
      dai: toBN(startDaiAmount),
      card: toBN('0'),
    });

    hijackApprove(layer1Service, (_amountInWei: BN) => {
      weiSentToApprove = _amountInWei;
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

    await fillIn('[data-test-deposit-amount-input]', daiToSend);
    assert.dom('[data-test-unlock-button]').isNotDisabled();

    await click('[data-test-unlock-button]');

    assert.equal(weiSentToApprove.toString(), toBN(daiToSendInWei).toString());
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

    assert.dom('[data-test-deposit-amount-input]').hasValue('');
    assert.dom('[data-test-unlock-button]').isDisabled();

    await fillIn('[data-test-deposit-amount-input]', invalidDai1);
    assert.dom('[data-test-deposit-amount-input]').hasValue(invalidDai1);
    assert.dom('[data-test-unlock-button]').isDisabled();

    await fillIn('[data-test-deposit-amount-input]', validAmount);
    assert.dom('[data-test-deposit-amount-input]').hasValue(validAmount);
    assert.dom('[data-test-unlock-button]').isNotDisabled();

    await fillIn('[data-test-deposit-amount-input]', invalidDai2);
    assert.dom('[data-test-deposit-amount-input]').hasValue(validAmount);
    assert.dom('[data-test-unlock-button]').isNotDisabled();

    await fillIn('[data-test-deposit-amount-input]', '');
    assert.dom('[data-test-deposit-amount-input]').hasValue('');
    assert.dom('[data-test-unlock-button]').isDisabled();

    await typeIn('[data-test-deposit-amount-input]', invalidDai2);
    assert.dom('[data-test-deposit-amount-input]').hasValue('11');
    assert.dom('[data-test-unlock-button]').isNotDisabled();

    await fillIn('[data-test-deposit-amount-input]', '');
    await typeIn('[data-test-deposit-amount-input]', invalidDai3);
    assert.dom('[data-test-deposit-amount-input]').hasValue('1');
    assert.dom('[data-test-unlock-button]').isNotDisabled();

    await fillIn('[data-test-deposit-amount-input]', '');
    await typeIn('[data-test-deposit-amount-input]', invalidDai4);
    assert.dom('[data-test-deposit-amount-input]').hasValue('12');
    assert.dom('[data-test-unlock-button]').isNotDisabled();

    await fillIn('[data-test-deposit-amount-input]', startDaiString);
    assert.dom('[data-test-deposit-amount-input]').hasValue(startDaiString);
    assert.dom('[data-test-unlock-button]').isNotDisabled();
  });
});
