import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer1TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer1';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import BN from 'bn.js';

import { Safe } from '@cardstack/cardpay-sdk/sdk/safes';
import { WorkflowSession } from '@cardstack/web-client/models/workflow';
import {
  createDepotSafe,
  createMerchantSafe,
  createPrepaidCardSafe,
  createSafeToken,
} from '@cardstack/web-client/tests/helpers/factories';

module(
  'Integration | Component | card-pay/withdrawal-workflow/choose-balance',
  function (hooks) {
    setupRenderingTest(hooks);

    test('It should allow a layer 2 safe and balance to be chosen', async function (assert) {
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
      await layer2Service.test__simulateBalances({
        defaultToken: new BN('250000000000000000000'),
        card: new BN('500000000000000000000'),
      });
      let depotAddress = '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666';
      let testDepot = createDepotSafe({
        address: depotAddress,
        tokens: [
          createSafeToken('DAI', '250000000000000000000'),
          createSafeToken('CARD', '500000000000000000000'),
        ],
      });

      layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
      await layer2Service.test__simulateDepot(testDepot);

      let merchantAddress = '0xmerchantbAB0644ffCD32518eBF4924ba8666666';

      layer2Service.test__simulateAccountSafes(layer2AccountAddress, [
        createMerchantSafe({
          address: merchantAddress,
          merchant: '0xprepaidDbAB0644ffCD32518eBF4924ba8666666',
          tokens: [
            createSafeToken('DAI', '125000000000000000000'),
            createSafeToken('CARD', '450000000000000000000'),
          ],
          accumulatedSpendValue: 100,
        }),
        createPrepaidCardSafe({
          address: '0xprepaidDbAB0644ffCD32518eBF4924ba8666666',
          owners: [layer2AccountAddress],
          spendFaceValue: 2324,
          prepaidCardOwner: layer2AccountAddress,
          issuer: layer2AccountAddress,
          transferrable: false,
        }),
      ]);

      // Ensure safes have been loaded, as in a workflow context
      await layer2Service.refreshSafesAndBalances();
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
        .containsText('Choose a source and balance to withdraw from');
      assert
        .dom('[data-test-choose-balance-from-wallet]')
        .containsText('L2 test chain');
      assert
        .dom('[data-test-choose-balance-from-address]')
        .containsText('0x1826...6E44');
      assert
        .dom('[data-test-choose-balance-from-safe]')
        .containsText(depotAddress, 'defaults to depot safe source');
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
        .containsText('250.00 DAI.CPXD');
      assert
        .dom('.ember-power-select-options li:nth-child(2)')
        .containsText('500.00 CARD.CPXD');
      await click('.ember-power-select-options li:nth-child(2)');

      assert
        .dom(
          '[data-test-balance-chooser-dropdown] [data-test-balance-display-name]'
        )
        .containsText('CARD.CPXD');

      await click(
        '[data-test-safe-chooser-dropdown] .ember-power-select-trigger'
      );
      assert.dom('.ember-power-select-options li').exists({ count: 2 });
      assert
        .dom('.ember-power-select-options li:nth-child(1)')
        .containsText('DEPOT 0xB236ca8DbAB0644ffCD32518eBF4924ba8666666');
      assert
        .dom('.ember-power-select-options li:nth-child(2)')
        .containsText(merchantAddress);
      await click('.ember-power-select-options li:nth-child(2)');

      assert
        .dom('[data-test-balance-chooser-dropdown]')
        .containsText(
          '450.00 CARD.CPXD',
          'changing the safe updates the balance for the chosen token'
        );

      await click(
        '[data-test-balance-chooser-dropdown] .ember-power-select-trigger'
      );
      assert.dom('.ember-power-select-options li').exists({ count: 2 });
      assert
        .dom('.ember-power-select-options li:nth-child(1)')
        .containsText('125.00 DAI.CPXD');
      assert
        .dom('.ember-power-select-options li:nth-child(2)')
        .containsText('450.00 CARD.CPXD');
      await click('.ember-power-select-options li:nth-child(2)');

      assert
        .dom('[data-test-choose-balance-receive] [data-test-account-name]')
        .containsText('L1 test chain');
      assert
        .dom('[data-test-choose-balance-receive] [data-test-account-address]')
        .containsText(layer1AccountAddress);
      assert.dom('[data-test-choose-balance-from-display]').doesNotExist();

      await click('[data-test-boxel-action-chin] [data-test-boxel-button]');
      assert.equal(
        session.getValue('withdrawalToken'),
        'CARD.CPXD',
        'workflow session withdrawal token updated'
      );
      assert.equal(
        session.getValue<Safe>('withdrawalSafe')?.address,
        merchantAddress,
        'workflow session withdrawal safe updated'
      );
    });
  }
);
