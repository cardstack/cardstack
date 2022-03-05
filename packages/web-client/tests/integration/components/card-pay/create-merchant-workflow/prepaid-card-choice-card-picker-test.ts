import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render, waitFor } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { WorkflowSession } from '@cardstack/web-client/models/workflow';
import { createPrepaidCardSafe } from '@cardstack/web-client/utils/test-factories';

module(
  'Integration | Component | card-pay/create-merchant/prepaid-card-choice-card-picker edge cases',
  function (hooks) {
    let layer2Service: Layer2TestWeb3Strategy;
    let prepaidCardAddress: string;
    let prepaidCardAddress2: string;

    setupRenderingTest(hooks);

    hooks.beforeEach(async function (this) {
      layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;

      let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
      prepaidCardAddress = '0x123400000000000000000000000000000000abcd';
      prepaidCardAddress2 = '0x432100000000000000000000000000000000dbca';

      layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
        createPrepaidCardSafe({
          address: prepaidCardAddress2,
          owners: [layer2AccountAddress],
          spendFaceValue: 500,
          prepaidCardOwner: layer2AccountAddress,
          issuer: layer2AccountAddress,
        }),
        createPrepaidCardSafe({
          address: prepaidCardAddress,
          owners: [layer2AccountAddress],
          spendFaceValue: 2324,
          prepaidCardOwner: layer2AccountAddress,
          issuer: layer2AccountAddress,
        }),
      ]);

      await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

      let workflowSession = new WorkflowSession();
      workflowSession.setValue({
        merchantName: 'Mandello',
        merchantId: 'mandello1',
        merchantBgColor: '#ff5050',
        merchantTextColor: '#fff',
        merchantRegistrationFee: 1000,
      });

      this.setProperties({
        onComplete: () => {},
        onIncomplete: () => {},
        isComplete: false,
        frozen: false,
        workflowSession,
      });

      await render(hbs`
        <CardPay::CreateMerchantWorkflow::PrepaidCardChoice
          @onComplete={{this.onComplete}}
          @isComplete={{this.isComplete}}
          @onIncomplete={{this.onIncomplete}}
          @workflowSession={{this.workflowSession}}
          @frozen={{this.frozen}}
        />
      `);
    });

    test('it preselects prepaid card if there is only one valid option', async function (assert) {
      assert
        .dom(
          `[data-test-boxel-card-picker-selected-card] [data-test-prepaid-card="${prepaidCardAddress}"]`
        )
        .exists();

      await click(`[data-test-boxel-card-picker-dropdown] > [role="button"]`);
      await waitFor(
        `[data-test-boxel-card-picker-dropdown] [data-test-card-picker-dropdown-option="${prepaidCardAddress}"]`
      );
      assert
        .dom(
          `[data-test-boxel-card-picker-dropdown] [data-test-card-picker-dropdown-option]`
        )
        .exists({ count: 2 });
      assert
        .dom(
          `[data-test-card-picker-dropdown-option="${prepaidCardAddress2}"][data-test-card-picker-dropdown-option-disabled]`
        )
        .exists();
    });

    test('it disables and fades out cards with insufficient balance', async function (assert) {
      await click(`[data-test-boxel-card-picker-dropdown] > [role="button"]`);
      await waitFor(
        `[data-test-card-picker-dropdown-option="${prepaidCardAddress}"]`
      );

      assert
        .dom(
          `[data-test-boxel-card-picker-dropdown] [data-test-card-picker-dropdown-option]`
        )
        .exists({ count: 2 });
      assert
        .dom(`[data-test-card-picker-dropdown-option-disabled]`)
        .exists({ count: 1 });
      assert
        .dom(
          `[data-test-boxel-card-picker-dropdown] li:nth-of-type(2)[aria-disabled="true"]`
        )
        .exists();
      assert
        .dom(
          `[data-test-card-picker-dropdown-option="${prepaidCardAddress2}"][data-test-card-picker-dropdown-option-disabled]`
        )
        .exists();
    });
  }
);
