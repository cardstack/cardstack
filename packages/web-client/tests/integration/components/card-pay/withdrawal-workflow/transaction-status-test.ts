import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, settled } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';

import sinon from 'sinon';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';

let layer2Service: Layer2TestWeb3Strategy;

module(
  'Integration | Component | card-pay/withdrawal-workflow/transaction-status',
  function (hooks) {
    let onComplete = sinon.spy();

    setupRenderingTest(hooks);

    hooks.beforeEach(async function () {
      let workflowSession = new WorkflowSession();
      workflowSession.updateMany({
        layer2BlockHeightBeforeBridging: 1234,
        relayTokensTxnHash: 'relay',
        withdrawalToken: 'CARD.CPXD',
      });

      this.setProperties({
        onComplete,
        onIncomplete: () => {},
        isComplete: false,
        frozen: false,
        workflowSession,
      });

      layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;

      layer2Service.bridgeToLayer1('0xbridged', 'DAI', '20');

      await render(hbs`
        <CardPay::WithdrawalWorkflow::TransactionStatus
          @onComplete={{this.onComplete}}
          @isComplete={{this.isComplete}}
          @onIncomplete={{this.onIncomplete}}
          @workflowSession={{this.workflowSession}}
          @frozen={{this.frozen}}
        />
      `);
    });

    test('It renders transaction status and links', async function (assert) {
      assert.dom('[data-test-action-card-title-icon-name="clock"]').exists();

      assert
        .dom(`[data-test-token-bridge-step="0"][data-test-completed]`)
        .containsText(`Withdraw tokens from ${c.layer2.fullName}`);
      assert
        .dom(`[data-test-blockscout-button]`)
        .hasAttribute('href', /relay$/);

      assert
        .dom(`[data-test-token-bridge-step="1"]:not([data-test-completed])`)
        .containsText(
          `Bridge tokens from ${c.layer2.fullName} to ${c.layer1.fullName}`
        );
      assert
        .dom(`[data-test-bridge-explorer-button]`)
        .hasAttribute('href', /relay$/);
    });

    test('It completes when the bridged transaction completes', async function (assert) {
      assert.ok(onComplete.notCalled);

      layer2Service.test__simulateBridgedToLayer1();

      await settled();

      assert
        .dom(`[data-test-token-bridge-step="1"][data-test-completed]`)
        .exists();
      assert
        .dom(`[data-test-bridge-explorer-button]`)
        .hasAttribute('href', /relay$/);

      assert
        .dom('[data-test-action-card-title-icon-name="success-bordered"]')
        .exists();

      assert.ok(onComplete.called);
    });
  }
);
