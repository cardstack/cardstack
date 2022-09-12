import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { toWei } from 'web3-utils';
import BN from 'bn.js';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { WorkflowSession } from '@cardstack/web-client/models/workflow';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { MirageTestContext } from 'ember-cli-mirage/test-support';
import {
  createDepotSafe,
  createProfileSafe,
  createPrepaidCardSafe,
  createSafeToken,
} from '@cardstack/web-client/utils/test-factories';
import { DepotSafe, MerchantSafe } from '@cardstack/cardpay-sdk';
import { faceValueOptions } from '@cardstack/web-client/components/card-pay/issue-prepaid-card-workflow';
import Layer2Network from '@cardstack/web-client/services/layer2-network';

interface Context extends MirageTestContext {}

const MIN_SPEND_AMOUNT = Math.min(...faceValueOptions);
const MIN_AMOUNT_TO_PASS = new BN(
  toWei(`${Math.ceil(MIN_SPEND_AMOUNT / 100)}`)
);

module(
  'Integration | Component | card-pay/issue-prepaid-card-workflow/funding-source',
  function (hooks) {
    let layer2Service: Layer2TestWeb3Strategy;
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    let depotSafe: DepotSafe;
    let profileSafe: MerchantSafe;
    let workflowSession: WorkflowSession;

    setupRenderingTest(hooks);
    setupMirage(hooks);

    module('when there is a depot safe', function (hooks) {
      hooks.beforeEach(async function (this: Context) {
        layer2Service = (
          this.owner.lookup('service:layer2-network') as Layer2Network
        ).strategy as Layer2TestWeb3Strategy;

        depotSafe = createDepotSafe({
          owners: [layer2AccountAddress],
          tokens: [
            createSafeToken('DAI.CPXD', '125000000000000000000'),
            createSafeToken('CARD.CPXD', '450000000000000000000'),
          ],
        });

        profileSafe = createProfileSafe({
          address: '0xmerchantbAB0644ffCD32518eBF4924ba8666666',
          merchant: '0xprepaidDbAB0644ffCD32518eBF4924ba8666666',
          tokens: [
            createSafeToken('DAI.CPXD', MIN_AMOUNT_TO_PASS.toString()),
            createSafeToken('CARD.CPXD', '450000000000000000000'),
          ],
          accumulatedSpendValue: 100,
        });

        layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
          depotSafe,
          profileSafe,
          createProfileSafe({
            address: 'low-balance-safe',
            merchant: '0xprepaidDbAB0644ffCD32518eBF4924ba8666666',
            tokens: [createSafeToken('DAI.CPXD', '1')],
            accumulatedSpendValue: 100,
          }),
          createPrepaidCardSafe({
            address: '0xprepaidDbAB0644ffCD32518eBF4924ba8666666',
            owners: [layer2AccountAddress],
            tokens: [
              createSafeToken('DAI.CPXD', '125000000000000000000'),
              createSafeToken('CARD.CPXD', '450000000000000000000'),
            ],
            spendFaceValue: 2324,
            prepaidCardOwner: layer2AccountAddress,
            issuer: layer2AccountAddress,
            transferrable: false,
          }),
        ]);

        layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

        workflowSession = new WorkflowSession();
        workflowSession.setValue('daiMinValue', MIN_AMOUNT_TO_PASS);

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

      test('it falls back to the first safe with a sufficient balance if the depot safe has insufficient balance', async function (assert) {
        depotSafe.tokens = [createSafeToken('DAI.CPXD', '1')];
        layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

        await render(hbs`
          <CardPay::IssuePrepaidCardWorkflow::FundingSource
            @onComplete={{this.onComplete}}
            @isComplete={{this.isComplete}}
            @onIncomplete={{this.onIncomplete}}
            @workflowSession={{this.workflowSession}}
            @frozen={{this.frozen}}
          />
        `);

        assert.dom('[data-test-funding-source-safe]').containsText('Profile');
      });

      test('it uses the safe from the workflow when it exists', async function (this: Context, assert) {
        workflowSession.setValue(
          'prepaidFundingSafeAddress',
          profileSafe.address
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

        assert.dom('[data-test-funding-source-safe]').containsText('Profile');
      });

      test('it only lists compatible safes with balances of compatible tokens that exceed the minimum in the workflow', async function (this: Context, assert) {
        await render(hbs`
          <CardPay::IssuePrepaidCardWorkflow::FundingSource
            @onComplete={{this.onComplete}}
            @isComplete={{this.isComplete}}
            @onIncomplete={{this.onIncomplete}}
            @workflowSession={{this.workflowSession}}
            @frozen={{this.frozen}}
          />
        `);
        await click('[data-test-safe-chooser-dropdown]');
        assert.dom('.ember-power-select-options li').exists({ count: 2 });
      });

      test('it renders an error message when no safe with sufficient balances exists', async function (assert) {
        depotSafe.tokens = [createSafeToken('DAI.CPXD', '1')];
        profileSafe.tokens = [createSafeToken('DAI.CPXD', '1')];
        layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

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
          .dom('[data-test-insufficient-balance-message]')
          .containsText('5 DAI.CPXD');
        assert.dom('[data-test-boxel-button]').isDisabled();
      });
    });

    test('it renders the proper fallback balance when there is no depot safe', async function (assert) {
      layer2Service = (
        this.owner.lookup('service:layer2-network') as Layer2Network
      ).strategy as Layer2TestWeb3Strategy;

      profileSafe = createProfileSafe({
        address: '0xmerchantbAB0644ffCD32518eBF4924ba8666666',
        merchant: '0xprepaidDbAB0644ffCD32518eBF4924ba8666666',
        tokens: [
          createSafeToken('DAI.CPXD', MIN_AMOUNT_TO_PASS.toString()),
          createSafeToken('CARD.CPXD', '450000000000000000000'),
        ],
        accumulatedSpendValue: 100,
      });

      layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
        profileSafe,
      ]);

      layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

      workflowSession = new WorkflowSession();
      workflowSession.setValue('daiMinValue', MIN_AMOUNT_TO_PASS);

      this.setProperties({
        onComplete: () => {},
        onIncomplete: () => {},
        isComplete: false,
        frozen: false,
        workflowSession,
      });

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
        .dom('[data-test-balance-chooser-dropdown]')
        .containsText('5.00 DAI.CPXD');
    });
  }
);
