import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';

module(
  'Integration | Component | card-pay/withdrawal-workflow/transaction-status',
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(async function () {
      let workflowSession = new WorkflowSession();
      workflowSession.updateMany({
        relayTokensTxnReceipt: {
          transactionHash: 'bridgeexplorer',
        },
        completedLayer2TransactionReceipt: {
          transactionHash: 'blockscout',
        },
      });

      this.setProperties({
        onComplete: () => {},
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
        .hasAttribute('href', /blockscout$/);

      assert
        .dom(`[data-test-token-bridge-step="1"]:not([data-test-completed])`)
        .containsText(
          `Bridge tokens from ${c.layer2.fullName} to ${c.layer1.fullName}`
        );
      assert
        .dom(`[data-test-bridge-explorer-button]`)
        .hasAttribute('href', /bridgeexplorer$/);

      assert
        .dom(`[data-test-token-bridge-step="2"]:not([data-test-completed])`)
        .containsText(
          `Release tokens on ${c.layer1.conversationalName}: ${c.layer2.shortName}`
        );
      assert.dom(`[data-test-etherscan-button]`).doesNotExist();
    });
  }
);
