import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, waitFor } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import BN from 'bn.js';
import sinon from 'sinon';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';

module(
  'Integration | Component | card-pay/deposit-workflow/transaction-status',
  function (hooks) {
    setupRenderingTest(hooks);

    test('It shows a blockscout button if bridging succeeds', async function (assert) {
      let onComplete = sinon.spy();
      let workflowSession = new WorkflowSession();
      workflowSession.updateMany({
        depositSourceToken: 'DAI',
        layer2BlockHeightBeforeBridging: new BN('0'),
        relayTokensTxnReceipt: {
          transactionHash: 'RelayTokensTransactionHash',
        },
      });
      const layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;

      layer2Service.balancesRefreshed = false;

      this.setProperties({
        onComplete,
        onIncomplete: () => {},
        isComplete: false,
        frozen: false,
        workflowSession,
      });

      await render(hbs`
          <CardPay::DepositWorkflow::TransactionStatus
            @onComplete={{this.onComplete}}
            @isComplete={{this.isComplete}}
            @onIncomplete={{this.onIncomplete}}
            @workflowSession={{this.workflowSession}}
            @frozen={{this.frozen}}
          />
        `);

      assert
        .dom(`[data-test-token-bridge-step="0"][data-test-completed]`)
        .exists();
      assert.dom('[data-test-etherscan-button]').exists();
      assert
        .dom(`[data-test-token-bridge-step="1"]:not([data-test-completed])`)
        .exists();
      assert.dom('[data-test-bridge-explorer-button]').exists();
      assert
        .dom(`[data-test-token-bridge-step="2"]:not([data-test-completed])`)
        .exists();
      assert.dom('[data-test-blockscout-button]').doesNotExist();

      // bridging should also refresh layer 2 balances so we want to ensure that here
      layer2Service.balancesRefreshed = false;

      layer2Service.test__simulateBridgedToLayer2(
        'CompletedLayer2TransactionHash'
      );

      assert.dom(`[data-test-step-2="complete"]`);
      assert.dom(`[data-test-step-3="complete"]`);

      await waitFor('[data-test-blockscout-button]');

      assert.ok(
        layer2Service.balancesRefreshed,
        'Balances for layer 2 should be refreshsed after bridging'
      );
      assert.dom('[data-test-blockscout-button]').exists();
      assert.dom('[data-test-deposit-minting-step-failed]').doesNotExist();
      assert.dom('[data-test-deposit-transaction-status-error]').doesNotExist();

      assert.ok(onComplete.called);
    });

    test('It shows an error message if bridging fails', async function (assert) {
      let onComplete = sinon.spy();
      let workflowSession = new WorkflowSession();
      workflowSession.updateMany({
        depositSourceToken: 'DAI',
        layer2BlockHeightBeforeBridging: new BN('0'),
        relayTokensTxnReceipt: {
          transactionHash: 'RelayTokensTransactionHash',
        },
      });
      const layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;

      sinon
        .stub(layer2Service, 'awaitBridgedToLayer2')
        .throws(new Error('Huh?'));

      this.setProperties({
        onComplete,
        onIncomplete: () => {},
        isComplete: false,
        frozen: false,
        workflowSession,
      });

      await render(hbs`
          <CardPay::DepositWorkflow::TransactionStatus
            @onComplete={{this.onComplete}}
            @isComplete={{this.isComplete}}
            @onIncomplete={{this.onIncomplete}}
            @workflowSession={{this.workflowSession}}
            @frozen={{this.frozen}}
          />
        `);

      assert.dom(`[data-test-blockscout-button]`).doesNotExist();
      assert
        .dom('[data-test-deposit-minting-step-failed]')
        .containsText('Failed');
      assert
        .dom('[data-test-deposit-transaction-status-error]')
        .containsText(
          `There was a problem completing the bridging of your tokens to ${c.layer2.fullName}. Please contact Cardstack support so that we can investigate and resolve this issue for you.`
        );

      assert.ok(onComplete.notCalled);
    });
  }
);
