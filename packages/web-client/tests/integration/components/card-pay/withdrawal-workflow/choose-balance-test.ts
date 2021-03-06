import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { toBN } from 'web3-utils';
import { DepotSafe } from '@cardstack/cardpay-sdk/sdk/safes';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';

module(
  'Integration | Component | card-pay/withdrawal-workflow/choose-balance',
  function (hooks) {
    setupRenderingTest(hooks);

    test('It should allow a layer 2 balance to be chosen', async function (assert) {
      let session = new WorkflowSession();
      this.set('session', session);
      let layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;
      let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
      layer2Service.test__simulateBalances({
        defaultToken: toBN('250000000000000000000'),
        card: toBN('500000000000000000000'),
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
      layer2Service.test__simulateDepot(testDepot as DepotSafe);
      layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
      await render(hbs`
        <CardPay::WithdrawalWorkflow::ChooseBalance
          @workflowSession={{this.session}}
          @onComplete={{this.onComplete}}
          @onIncomplete={{this.onIncomplete}}
          @isComplete={{this.isComplete}}
        />
      `);
      assert
        .dom('.action-card__title')
        .containsText('Choose a depot and balance to withdraw from');
      assert
        .dom('[data-test-account-depot-outer] [data-test-account-address]')
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
      await click('[data-test-boxel-action-chin] [data-test-boxel-button]');
      assert.equal(
        session.state.withdrawalToken,
        'CARD.CPXD',
        'workflow session state updated'
      );
    });
  }
);
