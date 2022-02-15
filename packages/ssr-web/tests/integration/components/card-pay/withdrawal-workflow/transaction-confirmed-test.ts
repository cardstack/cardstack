import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer2TestWeb3Strategy from '@cardstack/ssr-web/utils/web3-strategies/test-layer2';
import Layer1TestWeb3Strategy from '@cardstack/ssr-web/utils/web3-strategies/test-layer1';
import BN from 'bn.js';

import { WorkflowSession } from '@cardstack/ssr-web/models/workflow';
import {
  createDepotSafe,
  createSafeToken,
} from '@cardstack/ssr-web/utils/test-factories';

module(
  'Integration | Component | card-pay/withdrawal-workflow/transaction-confirmed',
  function (hooks) {
    setupRenderingTest(hooks);

    test('It displays the correct data', async function (assert) {
      let session = new WorkflowSession();
      this.set('session', session);

      let layer1AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
      let layer1Service = this.owner.lookup('service:layer1-network')
        .strategy as Layer1TestWeb3Strategy;
      layer1Service.test__simulateAccountsChanged(
        [layer1AccountAddress],
        'metamask'
      );
      layer1Service.test__simulateBalances({
        dai: new BN('150500000000000000000'),
      });

      let layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;
      let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
      let depotAddress = '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666';
      let testDepot = createDepotSafe({
        address: depotAddress,
        tokens: [createSafeToken('DAI.CPXD', '250000000000000000000')],
      });
      await layer2Service.test__simulateRemoteAccountSafes(
        layer2AccountAddress,
        [testDepot]
      );
      await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
      session.setValue('withdrawalSafe', depotAddress);
      session.setValue('withdrawalToken', 'DAI.CPXD');
      session.setValue('withdrawnAmount', new BN('123456000000000000000'));

      await render(hbs`
        <CardPay::WithdrawalWorkflow::TransactionConfirmed
          @workflowSession={{this.session}}
          @onComplete={{this.onComplete}}
          @onIncomplete={{this.onIncomplete}}
          @isComplete={{this.isComplete}}
        />
      `);

      assert
        .dom('[data-test-transaction-confirmed-from-section] header')
        .hasText('You withdrew');
      assert
        .dom(
          '[data-test-withdrawal-transaction-confirmed-from] [data-test-bridge-item-network]'
        )
        .containsText('L2 test chain');
      assert
        .dom(
          '[data-test-withdrawal-transaction-confirmed-from] [data-test-bridge-item-amount]'
        )
        .containsText('123.456 DAI.CPXD');
      assert
        .dom(
          '[data-test-withdrawal-transaction-confirmed-from] [data-test-bridge-item-wallet]'
        )
        .containsText('0x1826...6E44');
      assert
        .dom(
          '[data-test-withdrawal-transaction-confirmed-from] [data-test-bridge-item-depot]'
        )
        .containsText('0xB236...6666');
      assert
        .dom(
          '[data-test-transaction-confirmed-from-section] [data-test-card-pay-bridge-action]'
        )
        .hasText('Burned on L2 test chain');

      assert
        .dom('[data-test-transaction-confirmed-to-section] header')
        .hasText('You received');
      assert
        .dom(
          '[data-test-transaction-confirmed-to-section] [data-test-card-pay-bridge-action]'
        )
        .hasText('Released on L1 test chain');
      assert
        .dom(
          '[data-test-withdrawal-transaction-confirmed-to] [data-test-bridge-item-network]'
        )
        .containsText('L1 test chain');
      assert
        .dom(
          '[data-test-withdrawal-transaction-confirmed-to] [data-test-bridge-item-amount]'
        )
        .containsText('123.456 DAI');
      assert
        .dom(
          '[data-test-withdrawal-transaction-confirmed-to] [data-test-bridge-item-wallet]'
        )
        .containsText(layer1AccountAddress);
    });
  }
);
