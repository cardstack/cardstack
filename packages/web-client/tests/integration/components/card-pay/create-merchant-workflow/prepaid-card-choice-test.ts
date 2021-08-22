import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render, waitFor } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import sinon from 'sinon';
import MerchantCustomization from '@cardstack/web-client/services/merchant-customization';
import { taskFor } from 'ember-concurrency-ts';

const USER_REJECTION_ERROR_MESSAGE =
  'It looks like you have canceled the request in your wallet. Please try again if you want to continue with this workflow.';
const TIMEOUT_ERROR_MESSAGE =
  'There was a problem creating your merchant. Please contact Cardstack support to find out the status of your transaction.';
const INSUFFICIENT_FUNDS_ERROR_MESSAGE = 'TODO insufficient funds message';
const DEFAULT_ERROR_MESSAGE =
  'There was a problem creating your merchant. This may be due to a network issue, or perhaps you canceled the request in your wallet. Please try again if you want to continue with this workflow, or contact Cardstack support.';

module(
  'Integration | Component | card-pay/create-merchant/prepaid-card-choice',
  function (hooks) {
    let layer2Service: Layer2TestWeb3Strategy;
    let merchantCustomizationService: MerchantCustomization;

    setupRenderingTest(hooks);

    hooks.beforeEach(async function () {
      layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;
      merchantCustomizationService = this.owner.lookup(
        'service:merchant-customization'
      ) as MerchantCustomization;

      let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
      let prepaidCardAddress = '0x123400000000000000000000000000000000abcd';

      layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

      layer2Service.test__simulateAccountSafes(layer2AccountAddress, [
        {
          type: 'prepaid-card',
          createdAt: Date.now() / 1000,

          address: prepaidCardAddress,

          tokens: [],
          owners: [layer2AccountAddress],

          issuingToken: '0xTOKEN',
          spendFaceValue: 2324,
          prepaidCardOwner: layer2AccountAddress,
          hasBeenUsed: false,
          issuer: layer2AccountAddress,
          reloadable: false,
          transferrable: false,
        },
      ]);

      let workflowSession = new WorkflowSession();
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

    test('it shows the correct data', async function (assert) {
      assert
        .dom('[data-test-prepaid-card-choice-merchant-fee]')
        .containsText('100 SPEND');
      // TODO: check other fields
    });

    module('Test the sdk register merchant calls', async function () {
      test('it shows the correct text in the creation button in the beginning and after errors', async function (assert) {
        sinon
          .stub(layer2Service, 'registerMerchant')
          .throws(new Error('An arbitrary error'));

        assert
          .dom('[data-test-create-merchant-button]')
          .containsText('Create Merchant');

        await click('[data-test-create-merchant-button]');
        await waitFor('[data-test-prepaid-card-choice-error-message]');

        assert
          .dom('[data-test-create-merchant-button]')
          .containsText('Try Again');
      });

      test('it shows the correct error message for a user rejection', async function (assert) {
        sinon
          .stub(layer2Service, 'registerMerchant')
          .throws(new Error('User rejected request'));

        await click('[data-test-create-merchant-button]');
        await waitFor('[data-test-prepaid-card-choice-error-message]');

        assert
          .dom('[data-test-prepaid-card-choice-error-message]')
          .containsText(USER_REJECTION_ERROR_MESSAGE);
      });

      test('it shows the correct error message for a timeout', async function (assert) {
        sinon
          .stub(layer2Service, 'registerMerchant')
          .throws(
            new Error(
              'Transaction took too long to complete, waited 30 seconds'
            )
          );

        await click('[data-test-create-merchant-button]');
        await waitFor('[data-test-prepaid-card-choice-error-message]');

        assert
          .dom('[data-test-prepaid-card-choice-error-message]')
          .containsText(TIMEOUT_ERROR_MESSAGE);
      });

      test('it shows the correct error message for the user not having enough of a token to create the merchant', async function (assert) {
        sinon
          .stub(layer2Service, 'registerMerchant')
          .throws(
            new Error(
              'Prepaid card does not have enough balance to register a merchant.'
            )
          );

        await click('[data-test-create-merchant-button]');
        await waitFor('[data-test-prepaid-card-choice-error-message]');

        assert
          .dom('[data-test-prepaid-card-choice-error-message]')
          .containsText(INSUFFICIENT_FUNDS_ERROR_MESSAGE);
      });

      test('it shows a correct fallback error message', async function (assert) {
        sinon
          .stub(layer2Service, 'registerMerchant')
          .throws(new Error('Not any matched error'));

        await click('[data-test-create-merchant-button]');
        await waitFor('[data-test-prepaid-card-choice-error-message]');

        assert
          .dom('[data-test-prepaid-card-choice-error-message]')
          .containsText(DEFAULT_ERROR_MESSAGE);
      });
    });

    test('it shows the fallback error message if the merchant customization service fails', async function (assert) {
      sinon
        .stub(
          taskFor(merchantCustomizationService.createCustomizationTask),
          'perform'
        )
        .throws(new Error('Any error will do'));

      await click('[data-test-create-merchant-button]');
      await waitFor('[data-test-prepaid-card-choice-error-message]');

      assert
        .dom('[data-test-prepaid-card-choice-error-message]')
        .containsText(DEFAULT_ERROR_MESSAGE);
    });
  }
);
