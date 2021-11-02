import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { find, render, settled, waitFor } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer1TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer1';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { WorkflowSession } from '@cardstack/web-client/models/workflow';
import sinon from 'sinon';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import { TransactionReceipt } from 'web3-core';

const depositSourceToken = 'DAI';
const stepTitles = {
  deposit: `Deposit tokens into reserve pool on ${c.layer1.fullName}`,
  bridge: `Bridge tokens from ${c.layer1.fullName} to ${c.layer2.fullName}`,
  mint: `Mint tokens on ${c.layer2.shortName}: ${depositSourceToken}.CPXD`,
};

module(
  'Integration | Component | card-pay/deposit-workflow/transaction-status',
  function (hooks) {
    setupRenderingTest(hooks);

    test('it updates UI to display progress as bridging proceeds', async function (assert) {
      let onComplete = sinon.spy();
      let workflowSession = new WorkflowSession();
      workflowSession.setValue({
        depositSourceToken,
        layer2BlockHeightBeforeBridging: '0',
        relayTokensTxnReceipt: {
          transactionHash: 'RelayTokensTransactionHash',
          blockNumber: 1,
        } as TransactionReceipt,
      });
      const layer1Service = this.owner.lookup('service:layer1-network')
        .strategy as Layer1TestWeb3Strategy;
      const layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;
      const blockCount = layer1Service.bridgeConfirmationBlockCount;

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

      assert.dom('[data-test-deposit-transaction-status-delay]').doesNotExist();

      assert
        .dom(`[data-test-token-bridge-step="0"][data-test-completed]`)
        .containsText(stepTitles.deposit);
      assert.dom(`[data-test-etherscan-button]`).exists();
      assert
        .dom(`[data-test-token-bridge-step][data-test-completed]`)
        .exists({ count: 1 });
      assert
        .dom(`[data-test-token-bridge-step="1"]`)
        .containsText(stepTitles.bridge);
      assert
        .dom(`[data-test-token-bridge-step-status="1"]`)
        .hasText(`0 of ${blockCount} blocks confirmed`);

      await settled();

      let etherscanHref = find('[data-test-etherscan-button]')?.getAttribute(
        'href'
      )!;
      assert
        .dom('[data-test-deposit-transaction-status-delay] a')
        .hasAttribute('href', etherscanHref);

      layer1Service.test__simulateBlockConfirmation();
      await waitFor(
        `[data-test-token-bridge-step-block-count="${blockCount}"]`
      );
      assert
        .dom(`[data-test-token-bridge-step-status="1"]`)
        .hasText(`${blockCount} of ${blockCount} blocks confirmed`);

      layer1Service.test__simulateBlockConfirmation();
      await waitFor(
        `[data-test-token-bridge-step-block-count="${blockCount + 1}"]`
      );
      assert
        .dom(`[data-test-token-bridge-step-status="1"]`)
        .hasText(`Waiting for bridge validators`);

      layer1Service.test__simulateBlockConfirmation();
      await waitFor(`[data-test-token-bridge-step="1"][data-test-completed]`);
      assert.dom(`[data-test-bridge-explorer-button]`).exists();
      assert
        .dom(`[data-test-token-bridge-step="2"][data-test-completed]`)
        .doesNotExist();
      assert.dom(`[data-test-blockscout-button]`).doesNotExist();

      let bridgeExplorerHerf = find(
        '[data-test-bridge-explorer-button]'
      )?.getAttribute('href')!;
      assert
        .dom('[data-test-deposit-transaction-status-delay] a')
        .hasAttribute('href', bridgeExplorerHerf);

      assert
        .dom('[data-test-deposit-transaction-status-delay]')
        .containsText(
          'Due to network conditions this transaction is taking longer to confirm'
        );

      // bridging should also refresh layer 2 balances so we want to ensure that here
      layer2Service.balancesRefreshed = false;

      layer2Service.test__simulateBridgedToLayer2(
        'CompletedLayer2TransactionHash'
      );

      await waitFor('[data-test-blockscout-button]');

      assert.ok(
        layer2Service.balancesRefreshed,
        'Balances for layer 2 should be refreshsed after bridging'
      );
      assert
        .dom(`[data-test-token-bridge-step="2"][data-test-completed]`)
        .containsText(stepTitles.mint);
      assert.dom('[data-test-blockscout-button]').exists();
      assert.dom('[data-test-deposit-minting-step-failed]').doesNotExist();
      assert.dom('[data-test-deposit-transaction-status-error]').doesNotExist();
      assert.dom('[data-test-deposit-transaction-status-delay]').doesNotExist();

      assert.ok(onComplete.called);
    });

    test('it displays all appropriate links and calls onComplete if it loads with appropriate data to complete the card', async function (assert) {
      let onComplete = sinon.spy();
      let workflowSession = new WorkflowSession();
      workflowSession.setValue({
        depositSourceToken,
        layer2BlockHeightBeforeBridging: '0',
        relayTokensTxnReceipt: {
          transactionHash: 'RelayTokensTransactionHash',
          blockNumber: 1,
        } as TransactionReceipt,
        completedLayer2TxnReceipt: {
          transactionHash: 'CompletedLayer2TransactionHash',
          blockNumber: 1,
        } as TransactionReceipt,
      });

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
        .containsText(stepTitles.deposit);
      assert.dom(`[data-test-etherscan-button]`).exists();
      assert
        .dom(`[data-test-token-bridge-step="1"][data-test-completed]`)
        .containsText(stepTitles.bridge);
      assert.dom(`[data-test-bridge-explorer-button]`).exists();
      assert
        .dom(`[data-test-token-bridge-step="2"][data-test-completed]`)
        .containsText(stepTitles.mint);
      assert.dom('[data-test-blockscout-button]').exists();

      assert.ok(onComplete.called);
    });

    test('it shows an error message if block confirmations fail', async function (assert) {
      const layer1Service = this.owner.lookup('service:layer1-network')
        .strategy as Layer1TestWeb3Strategy;

      let onComplete = sinon.spy();
      let workflowSession = new WorkflowSession();
      workflowSession.setValue({
        depositSourceToken,
        layer2BlockHeightBeforeBridging: '0',
        relayTokensTxnReceipt: {
          transactionHash: 'RelayTokensTransactionHash',
          blockNumber: 1,
        } as TransactionReceipt,
      });

      sinon
        .stub(layer1Service, 'getBlockConfirmation')
        .throws(new Error('Block confirmation error'));

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

      assert.dom(`[data-test-etherscan-button]`).exists();
      assert
        .dom('[data-test-deposit-bridging-step-failed]')
        .containsText('Failed');
      assert
        .dom('[data-test-deposit-transaction-status-error]')
        .containsText(
          `There was a problem completing the bridging of your tokens to ${c.layer2.fullName}. Please contact Cardstack support so that we can investigate and resolve this issue for you.`
        );

      assert.ok(onComplete.notCalled);
    });

    test('it shows an error message if bridging fails', async function (assert) {
      const layer1Service = this.owner.lookup('service:layer1-network')
        .strategy as Layer1TestWeb3Strategy;
      const layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;
      const blockCount = layer1Service.bridgeConfirmationBlockCount;

      let onComplete = sinon.spy();
      let workflowSession = new WorkflowSession();
      workflowSession.setValue({
        depositSourceToken,
        layer2BlockHeightBeforeBridging: '0',
        relayTokensTxnReceipt: {
          transactionHash: 'RelayTokensTransactionHash',
          blockNumber: 1,
        } as TransactionReceipt,
      });

      sinon
        .stub(layer2Service, 'awaitBridgedToLayer2')
        .throws(new Error('Bridging error'));

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

      layer1Service.test__simulateBlockConfirmation();
      await waitFor(
        `[data-test-token-bridge-step-block-count="${blockCount}"]`
      );
      layer1Service.test__simulateBlockConfirmation();
      await waitFor(
        `[data-test-token-bridge-step-block-count="${blockCount + 1}"]`
      );
      layer1Service.test__simulateBlockConfirmation();
      await waitFor(`[data-test-token-bridge-step="1"][data-test-completed]`);
      assert.dom(`[data-test-bridge-explorer-button]`).exists();

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
