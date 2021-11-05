import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { find, render, settled } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { WorkflowSession } from '@cardstack/web-client/models/workflow';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';

import sinon from 'sinon';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import {
  createDepotSafe,
  generateMockAddress,
} from '@cardstack/web-client/utils/test-factories';

const eoaAddress = generateMockAddress();
const safeAddress = generateMockAddress();

module(
  'Integration | Component | card-pay/withdrawal-workflow/transaction-status',
  function (hooks) {
    setupRenderingTest(hooks);

    let layer2Service: Layer2TestWeb3Strategy;
    let onComplete: sinon.SinonSpy;

    hooks.beforeEach(async function () {
      let workflowSession = new WorkflowSession();
      workflowSession.setValue({
        layer2BlockHeightBeforeBridging: 1234,
        relayTokensTxnHash: 'relay',
        withdrawalToken: 'CARD.CPXD',
        withdrawalSafe: safeAddress,
      });

      onComplete = sinon.spy();

      this.setProperties({
        onComplete,
        onIncomplete: () => {},
        isComplete: false,
        frozen: false,
        workflowSession,
      });

      layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;

      layer2Service.test__simulateRemoteAccountSafes(eoaAddress, [
        createDepotSafe({
          address: safeAddress,
          owners: [eoaAddress],
        }),
      ]);
      await layer2Service.test__simulateAccountsChanged([eoaAddress]);
      layer2Service.bridgeToLayer1(
        '0xsource',
        '0xdestination',
        'DAI.CPXD',
        '20'
      );
    });

    test('It renders transaction status and links', async function (assert) {
      await render(hbs`
        <CardPay::WithdrawalWorkflow::TransactionStatus
          @onComplete={{this.onComplete}}
          @isComplete={{this.isComplete}}
          @onIncomplete={{this.onIncomplete}}
          @workflowSession={{this.workflowSession}}
          @frozen={{this.frozen}}
        />
      `);

      assert.dom('[data-test-action-card-title-icon-name="clock"]').exists();
      assert
        .dom('[data-test-withdrawal-transaction-status-delay]')
        .doesNotExist();

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

      await settled();

      let bridgeExplorerHref = find(
        '[data-test-bridge-explorer-button]'
      )?.getAttribute('href')!;
      assert
        .dom('[data-test-withdrawal-transaction-status-delay] a')
        .hasAttribute('href', bridgeExplorerHref);
      assert
        .dom('[data-test-withdrawal-transaction-status-delay]')
        .containsText(
          'Due to network conditions this transaction is taking longer to confirm'
        );
    });

    test('It completes when the bridged transaction completes', async function (assert) {
      assert.ok(onComplete.notCalled);

      await render(hbs`
        <CardPay::WithdrawalWorkflow::TransactionStatus
          @onComplete={{this.onComplete}}
          @isComplete={{this.isComplete}}
          @onIncomplete={{this.onIncomplete}}
          @workflowSession={{this.workflowSession}}
          @frozen={{this.frozen}}
        />
      `);

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

    test('It shows an appropriate error message if bridging fails', async function (assert) {
      assert.ok(onComplete.notCalled);

      sinon
        .stub(layer2Service, 'awaitBridgedToLayer1')
        .throws(new Error('Huh?'));

      await render(hbs`
        <CardPay::WithdrawalWorkflow::TransactionStatus
          @onComplete={{this.onComplete}}
          @isComplete={{this.isComplete}}
          @onIncomplete={{this.onIncomplete}}
          @workflowSession={{this.workflowSession}}
          @frozen={{this.frozen}}
        />
      `);

      assert.dom(`[data-test-bridge-explorer-button]`).doesNotExist();
      assert
        .dom('[data-test-action-card-title-icon-name="success-bordered"]')
        .doesNotExist();

      assert
        .dom('[data-test-withdrawal-bridging-failed]')
        .containsText('Failed');
      assert
        .dom('[data-test-withdrawal-transaction-status-error]')
        .containsText(
          `There was a problem completing the bridging of your tokens to ${c.layer1.fullName}. Please contact Cardstack support so that we can investigate and resolve this issue for you.`
        );

      assert.ok(onComplete.notCalled);
    });
  }
);
