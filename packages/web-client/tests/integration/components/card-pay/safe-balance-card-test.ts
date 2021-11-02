import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';

import { WorkflowSession } from '@cardstack/web-client/models/workflow';
import {
  createDepotSafe,
  createMerchantSafe,
  createPrepaidCardSafe,
  createSafeToken,
} from '@cardstack/web-client/utils/test-factories';

module(
  'Integration | Component | card-pay/safe-balance-card',
  function (hooks) {
    setupRenderingTest(hooks);

    let layer2Service: Layer2TestWeb3Strategy;
    let session: WorkflowSession;
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    let depotAddress = '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666';
    let merchantAddress = '0xmerchantbAB0644ffCD32518eBF4924ba8666666';
    let prepaidCardAddress = '0xprepaidDbAB0644ffCD32518eBF4924ba8666666';

    hooks.beforeEach(async function () {
      session = new WorkflowSession();
      this.set('session', session);

      layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;
      layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
        createDepotSafe({
          address: depotAddress,
          tokens: [
            createSafeToken('DAI.CPXD', '250000000000000000000'),
            createSafeToken('CARD.CPXD', '500000000000000000000'),
          ],
        }),
        createMerchantSafe({
          address: merchantAddress,
          merchant: '0xprepaidDbAB0644ffCD32518eBF4924ba8666666',
          tokens: [
            createSafeToken('DAI.CPXD', '125000000000000000000'),
            createSafeToken('CARD.CPXD', '450000000000000000000'),
          ],
          accumulatedSpendValue: 100,
        }),
        createPrepaidCardSafe({
          address: prepaidCardAddress,
          owners: [layer2AccountAddress],
          tokens: [
            createSafeToken('DAI.CPXD', '225000000000000000000'),
            createSafeToken('CARD.CPXD', '0'),
          ],
          spendFaceValue: 2324,
          prepaidCardOwner: layer2AccountAddress,
          issuer: layer2AccountAddress,
          transferrable: false,
        }),
      ]);

      // Ensure safes have been loaded, as in a workflow context
      await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    });

    test('it renders the safe type and balances for the safe address specified in the workflow', async function (assert) {
      this.set('config', { safeAddressKey: 'prepaidFundingSafeAddress' });
      session.setValue('prepaidFundingSafeAddress', merchantAddress);

      await render(hbs`
        <CardPay::SafeBalanceCard
          @workflowSession={{this.session}}
          @onComplete={{this.onComplete}}
          @onIncomplete={{this.onIncomplete}}
          @config={{this.config}}
          @isComplete={{this.isComplete}}
        />
      `);

      assert
        .dom('[data-test-safe-address]')
        .containsText('Merchant address')
        .containsText(merchantAddress);
      assert.dom('[data-test-balance-label]').containsText('Merchant balance');
      assert
        .dom('[data-test-balance="DAI.CPXD"]')
        .containsText('125.00 DAI.CPXD');
      assert
        .dom('[data-test-balance="CARD.CPXD"]')
        .containsText('450.00 CARD.CPXD');
    });

    test('it can render balances for a prepaid card safe and filters out zero-balance tokens', async function (assert) {
      this.set('config', { safeAddressKey: 'withdrawalSafeAddress' });
      session.setValue('withdrawalSafeAddress', prepaidCardAddress);

      await render(hbs`
        <CardPay::SafeBalanceCard
          @workflowSession={{this.session}}
          @onComplete={{this.onComplete}}
          @onIncomplete={{this.onIncomplete}}
          @config={{this.config}}
          @isComplete={{this.isComplete}}
        />
      `);

      assert
        .dom('[data-test-safe-address]')
        .containsText('Prepaid card address')
        .containsText(prepaidCardAddress);
      assert
        .dom('[data-test-balance-label]')
        .containsText('Prepaid card balance');
      assert
        .dom('[data-test-balance="DAI.CPXD"]')
        .containsText('225.00 DAI.CPXD');
      assert.dom('[data-test-balance="CARD.CPXD"]').doesNotExist();
    });

    test('it shows a message when the wallet is disconnected', async function (assert) {
      this.set('config', { safeAddressKey: 'withdrawalSafeAddress' });
      session.setValue('withdrawalSafeAddress', prepaidCardAddress);
      layer2Service.test__simulateDisconnectFromWallet();

      await render(hbs`
        <CardPay::SafeBalanceCard
          @workflowSession={{this.session}}
          @onComplete={{this.onComplete}}
          @onIncomplete={{this.onIncomplete}}
          @config={{this.config}}
          @isComplete={{this.isComplete}}
        />
      `);

      assert.dom('[data-test-wallet-disconnected]').exists();
    });

    test('it shows a message when the safe is not found', async function (assert) {
      this.set('config', { safeAddressKey: 'withdrawalSafeAddress' });
      session.setValue('withdrawalSafeAddress', '0x000');

      await render(hbs`
        <CardPay::SafeBalanceCard
          @workflowSession={{this.session}}
          @onComplete={{this.onComplete}}
          @onIncomplete={{this.onIncomplete}}
          @config={{this.config}}
          @isComplete={{this.isComplete}}
        />
      `);

      assert.dom('[data-test-safe-not-found]').containsText('0x000');
    });
  }
);
