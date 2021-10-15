import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { WorkflowSession } from '@cardstack/web-client/models/workflow';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { MirageTestContext } from 'ember-cli-mirage/test-support';
import {
  createDepotSafe,
  createMerchantSafe,
} from '@cardstack/web-client/utils/test-factories';
import { MerchantSafe } from '@cardstack/cardpay-sdk';

interface Context extends MirageTestContext {}

module(
  'Integration | Component | card-pay/issue-prepaid-card-workflow/funding-source',
  function (hooks) {
    let layer2Service: Layer2TestWeb3Strategy;
    let merchantSafe: MerchantSafe;
    let workflowSession: WorkflowSession;

    setupRenderingTest(hooks);
    setupMirage(hooks);

    hooks.beforeEach(async function (this: Context) {
      layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;

      merchantSafe = createMerchantSafe({
        address: '0xmerchantbAB0644ffCD32518eBF4924ba8666666',
        merchant: '0xprepaidDbAB0644ffCD32518eBF4924ba8666666',
        tokens: [],
        accumulatedSpendValue: 100,
      });

      let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';

      layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
        createDepotSafe({
          owners: [layer2AccountAddress],
          tokens: [],
        }),
        merchantSafe,
      ]);

      layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

      workflowSession = new WorkflowSession();
      this.setProperties({
        onComplete: () => {},
        onIncomplete: () => {},
        isComplete: false,
        frozen: false,
        workflowSession,
      });
    });

    test('it defaults to the depot safe when one has not been set in the workflow', async function (assert) {
      await render(hbs`
        <CardPay::IssuePrepaidCardWorkflow::FundingSource
          @onComplete={{this.onComplete}}
          @isComplete={{this.isComplete}}
          @onIncomplete={{this.onIncomplete}}
          @workflowSession={{this.workflowSession}}
          @frozen={{this.frozen}}
        />
      `);

      assert.dom('[data-test-funding-source-safe]').containsText('DEPOT');
    });

    test('it uses the safe from the workflow when it exists', async function (this: Context, assert) {
      workflowSession.setValue(
        'prepaidFundingSafeAddress',
        merchantSafe.address
      );

      await render(hbs`
        <CardPay::IssuePrepaidCardWorkflow::FundingSource
          @onComplete={{this.onComplete}}
          @isComplete={{this.isComplete}}
          @onIncomplete={{this.onIncomplete}}
          @workflowSession={{this.workflowSession}}
          @frozen={{this.frozen}}
        />
      `);

      assert
        .dom('[data-test-funding-source-safe]')
        .containsText('Merchant account');
    });
  }
);
