import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer1TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer1';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import BN from 'bn.js';

import { DepotSafe } from '@cardstack/cardpay-sdk/sdk/safes';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';

module(
  'Integration | Component | card-pay/withdrawal-workflow/choose-balance',
  function (hooks) {
    setupRenderingTest(hooks);

    test('It should allow a layer 2 balance to be chosen', async function (assert) {
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
        card: new BN('350000000000000000000'),
      });

      let layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;
      let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
      layer2Service.test__simulateBalances({
        defaultToken: new BN('250000000000000000000'),
        card: new BN('500000000000000000000'),
      });
      let depotAddress = '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666';
      let testDepot = {
        address: depotAddress,
        tokens: [
          {
            balance: '250000000000000000000',
            token: {
              symbol: 'DAI',
            },
          },
          {
            balance: '500000000000000000000',
            token: {
              symbol: 'CARD',
            },
          },
        ],
      };
      layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
      layer2Service.test__simulateDepot(testDepot as DepotSafe);
      await render(hbs`
        <CardPay::WithdrawalWorkflow::ChooseBalance
          @workflowSession={{this.session}}
          @onComplete={{this.onComplete}}
          @onIncomplete={{this.onIncomplete}}
          @isComplete={{this.isComplete}}
        />
      `);
      assert.dom('.action-card__title').containsText('Withdraw tokens');
      assert
        .dom('[data-test-choose-balance-from-wallet]')
        .containsText('L2 test chain');
      assert
        .dom('[data-test-choose-balance-from-address]')
        .containsText('0x1826...6E44');
      assert
        .dom('[data-test-choose-balance-from-depot]')
        .containsText(depotAddress);
      assert
        .dom(
          '[data-test-balance-chooser-dropdown] [data-test-balance-display-name]'
        )
        .containsText('DAI.CPXD');
      await click(
        '[data-test-balance-chooser-dropdown] .ember-power-select-trigger'
      );
      assert.dom('.ember-power-select-options li').exists({ count: 2 });
      assert
        .dom('.ember-power-select-options li:nth-child(1)')
        .containsText('DAI.CPXD');
      assert
        .dom('.ember-power-select-options li:nth-child(2)')
        .containsText('CARD.CPXD');
      await click('.ember-power-select-options li:nth-child(2)');
      assert
        .dom(
          '[data-test-balance-chooser-dropdown] [data-test-balance-display-name]'
        )
        .containsText('CARD.CPXD');

      assert
        .dom('[data-test-choose-balance-receive] [data-test-account-name]')
        .containsText('L1 test chain');
      assert
        .dom('[data-test-choose-balance-receive] [data-test-account-address]')
        .containsText(layer1AccountAddress);
      assert.dom('[data-test-choose-balance-from-display]').doesNotExist();

      await click('[data-test-boxel-action-chin] [data-test-boxel-button]');
      assert.equal(
        session.state.withdrawalToken,
        'CARD.CPXD',
        'workflow session state updated'
      );
    });
  }
);
