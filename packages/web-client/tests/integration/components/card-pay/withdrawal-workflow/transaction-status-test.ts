import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, settled } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import Layer1TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer1';

import sinon from 'sinon';

module(
  'Integration | Component | card-pay/withdrawal-workflow/transaction-status',
  function (hooks) {
    let onComplete = sinon.spy();

    setupRenderingTest(hooks);

    hooks.beforeEach(async function () {
      let workflowSession = new WorkflowSession();
      workflowSession.updateMany({
        relayTokensTxnReceipt: {
          transactionHash: 'relay',
        },
        layer1BlockHeightBeforeBridging: 1234,
      });

      this.setProperties({
        onComplete,
        onIncomplete: () => {},
        isComplete: false,
        frozen: false,
        workflowSession,
      });

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

      assert
        .dom(`[data-test-token-bridge-step="2"]:not([data-test-completed])`)
        .containsText(
          `Release tokens on ${c.layer1.conversationalName}: ${c.layer2.shortName}`
        );
      assert.dom(`[data-test-etherscan-button]`).doesNotExist();
    });

    test('It completes when the bridged transaction completes', async function (assert) {
      assert.ok(onComplete.notCalled);

      let layer1Service = this.owner.lookup('service:layer1-network')
        .strategy as Layer1TestWeb3Strategy;

      layer1Service.test__simulateBridged('0xbridged');

      await settled();

      assert
        .dom(`[data-test-token-bridge-step="1"][data-test-completed]`)
        .exists();

      assert
        .dom(`[data-test-token-bridge-step="2"][data-test-completed]`)
        .exists();

      assert
        .dom(`[data-test-etherscan-button]`)
        .hasAttribute('href', /bridged$/);

      assert.ok(onComplete.called);
    });
  }
);
