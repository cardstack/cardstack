import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, fillIn, click } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { TransactionReceipt } from 'web3-core';
import Layer1TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer1';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import BN from 'bn.js';
import { toBN, toWei } from 'web3-utils';
import { defer } from 'rsvp';
import RSVP from 'rsvp';

module('Integration | Component | transaction-amount', function (hooks) {
  setupRenderingTest(hooks);

  const hijackApprove = (
    service: Layer1TestWeb3Strategy,
    fn: (_amountInWei: BN) => void // eslint-disable-line no-unused-vars
  ) => {
    service.approve = function approve(
      _amountInWei: BN, // eslint-disable-line no-unused-vars
      _token: string // eslint-disable-line no-unused-vars
    ) {
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
});
