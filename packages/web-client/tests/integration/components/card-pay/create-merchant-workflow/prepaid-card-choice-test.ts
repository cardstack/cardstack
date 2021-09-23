import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render, waitFor, waitUntil } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { WorkflowSession } from '@cardstack/web-client/models/workflow';
import sinon from 'sinon';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { MirageTestContext } from 'ember-cli-mirage/test-support';
import { Response as MirageResponse } from 'ember-cli-mirage';
import BN from 'bn.js';

interface Context extends MirageTestContext {}

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
    let prepaidCardAddress: string;
    let prepaidCardAddress2: string;

    setupRenderingTest(hooks);
    setupMirage(hooks);

    hooks.beforeEach(async function (this: Context) {
      layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;

      let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
      prepaidCardAddress = '0x123400000000000000000000000000000000abcd';
      prepaidCardAddress2 = '0x432100000000000000000000000000000000dbca';

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
        {
          type: 'prepaid-card',
          createdAt: Date.now() / 1000,

          address: prepaidCardAddress2,

          tokens: [],
          owners: [layer2AccountAddress],

          issuingToken: '0xTOKEN',
          spendFaceValue: 500,
          prepaidCardOwner: layer2AccountAddress,
          hasBeenUsed: false,
          issuer: layer2AccountAddress,
          reloadable: false,
          transferrable: false,
        },
      ]);

      let workflowSession = new WorkflowSession();
      workflowSession.updateMany({
        merchantName: 'Mandello',
        merchantId: 'mandello1',
        merchantBgColor: '#ff5050',
        merchantTextColor: '#fff',
        merchantRegistrationFee:
          await layer2Service.fetchMerchantRegistrationFee(),
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

    async function selectPrepaidCard(cardAddress: string) {
      await click(`[data-test-card-picker-dropdown] > [role="button"]`);
      await waitFor(`[data-test-card-picker-dropdown-option="${cardAddress}"]`);
      await click(`[data-test-card-picker-dropdown-option="${cardAddress}"]`);
    }

    test('it shows the correct data in default state', async function (assert) {
      assert
        .dom(`[data-test-boxel-card-container]`)
        .containsText('Choose a prepaid card to pay the merchant creation fee');
      assert
        .dom('[data-test-prepaid-card-choice-merchant-fee]')
        .containsText('100 SPEND');
      assert
        .dom('[data-test-merchant]')
        .hasAttribute('data-test-merchant', 'Mandello');
      assert
        .dom('[data-test-merchant-logo]')
        .hasAttribute('data-test-merchant-logo-background', '#ff5050')
        .hasAttribute('data-test-merchant-logo-text-color', '#fff');
      assert
        .dom('[data-test-prepaid-card-choice-merchant-id]')
        .containsText('mandello1');
      assert
        .dom(`[data-test-boxel-action-chin] [data-test-boxel-button]`)
        .isDisabled();
      assert
        .dom(`[data-test-card-picker-dropdown]`)
        .containsText('Select card');

      await click(`[data-test-card-picker-dropdown] > [role="button"]`);
      await waitFor(
        `[data-test-card-picker-dropdown-option="${prepaidCardAddress}"]`
      );

      assert
        .dom(`[data-test-card-picker-dropdown-option]`)
        .exists({ count: 2 });

      await click(
        `[data-test-card-picker-dropdown-option="${prepaidCardAddress}"]`
      );

      assert
        .dom(
          `[data-test-prepaid-card-choice-selected-card] [data-test-prepaid-card]`
        )
        .exists();
      assert
        .dom(`[data-test-card-picker-dropdown]`)
        .containsText('Change card');
      assert
        .dom(`[data-test-boxel-action-chin] [data-test-boxel-button]`)
        .isNotDisabled();
    });

    test('it allows changing selected prepaid card', async function (assert) {
      await selectPrepaidCard(prepaidCardAddress);

      assert
        .dom(
          `[data-test-prepaid-card-choice-selected-card] [data-test-prepaid-card="${prepaidCardAddress}"]`
        )
        .exists();
      assert
        .dom(`[data-test-prepaid-card-choice-selected-card]`)
        .containsText(prepaidCardAddress);
      assert
        .dom(`[data-test-prepaid-card-choice-selected-card]`)
        .containsText('2,324 SPEND');

      await selectPrepaidCard(prepaidCardAddress2);

      assert
        .dom(
          `[data-test-prepaid-card-choice-selected-card] [data-test-prepaid-card="${prepaidCardAddress2}"]`
        )
        .exists();
      assert
        .dom(`[data-test-prepaid-card-choice-selected-card]`)
        .containsText(prepaidCardAddress2);
      assert
        .dom(`[data-test-prepaid-card-choice-selected-card]`)
        .containsText('500 SPEND');
    });

    test('it displays the correct data in in-progress state', async function (assert) {
      await selectPrepaidCard(prepaidCardAddress);
      await click('[data-test-create-merchant-button]');
      await waitFor('[data-test-create-merchant-cancel-button]');

      assert
        .dom(`[data-test-boxel-card-container]`)
        .containsText('Choose a prepaid card to pay the merchant creation fee');
      assert
        .dom('[data-test-prepaid-card-choice-merchant-fee]')
        .containsText('100 SPEND');
      assert
        .dom('[data-test-prepaid-card-choice-merchant-id]')
        .containsText('mandello1');
      assert.dom(`[data-test-card-picker-dropdown]`).doesNotExist();
    });

    test('it allows canceling and retrying after a while', async function (assert) {
      assert
        .dom('[data-test-create-merchant-button]')
        .containsText('Create Merchant');

      await selectPrepaidCard(prepaidCardAddress);
      await click('[data-test-create-merchant-button]');

      assert.dom('[data-test-create-merchant-cancel-button]').doesNotExist();

      await waitFor('[data-test-create-merchant-cancel-button]');
      layer2Service.test__simulateOnNonceForRegisterMerchantRequest(
        prepaidCardAddress,
        new BN('12345')
      );

      await click('[data-test-create-merchant-cancel-button]');
      assert
        .dom(`[data-test-card-picker-dropdown]`)
        .containsText('Change card');
      assert.dom('[data-test-create-merchant-button]').hasText('Try Again');

      await click('[data-test-create-merchant-button]');
      await waitUntil(() =>
        layer2Service.test__getNonceForRegisterMerchantRequest(
          prepaidCardAddress
        )
      );
      assert.equal(
        layer2Service.test__getNonceForRegisterMerchantRequest(
          prepaidCardAddress
        ),
        '12345',
        'The same nonce as was used for the first attempt is sent for the second'
      );
    });

    module('Test the sdk register merchant calls', function () {
      test('it can call register merchant with selected prepaid card address', async function (assert) {
        let approveSpy = sinon.spy(layer2Service, 'registerMerchant');

        await selectPrepaidCard(prepaidCardAddress2);
        await click('[data-test-create-merchant-button]');
        await waitFor('[data-test-create-merchant-cancel-button]');

        assert.ok(
          approveSpy.calledWith(prepaidCardAddress2),
          'The address that the approve call is made with matches the prepaid card selected in the UI'
        );
      });

      test('it shows the correct text in the creation button in the beginning and after errors', async function (assert) {
        sinon
          .stub(layer2Service, 'registerMerchant')
          .throws(new Error('An arbitrary error'));

        assert
          .dom('[data-test-create-merchant-button]')
          .containsText('Create Merchant');

        await selectPrepaidCard(prepaidCardAddress);
        await click('[data-test-create-merchant-button]');
        await waitFor('[data-test-prepaid-card-choice-error-message]');

        assert.dom('[data-test-create-merchant-button]');
      });

      test('it shows the correct error message for a user rejection', async function (assert) {
        sinon
          .stub(layer2Service, 'registerMerchant')
          .throws(new Error('User rejected request'));

        await selectPrepaidCard(prepaidCardAddress);
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

        await selectPrepaidCard(prepaidCardAddress);
        await click('[data-test-create-merchant-button]');
        await waitFor('[data-test-prepaid-card-choice-error-message]');

        assert
          .dom('[data-test-prepaid-card-choice-error-message]')
          .containsText(TIMEOUT_ERROR_MESSAGE);
      });

      test('it only makes one Hub call to persist when trying again after a timeout', async function (assert) {
        let stub = sinon
          .stub(layer2Service, 'registerMerchant')
          .throws(
            new Error(
              'Transaction took too long to complete, waited 30 seconds'
            )
          );

        await selectPrepaidCard(prepaidCardAddress);
        await click('[data-test-create-merchant-button]');
        await waitFor('[data-test-prepaid-card-choice-error-message]');

        stub.restore();

        await click('[data-test-create-merchant-button]');

        let merchantInfoStorageRequests = (
          this as any
        ).server.pretender.handledRequests.filter((req: { url: string }) =>
          req.url.includes('merchant-infos')
        );

        assert.equal(
          merchantInfoStorageRequests.length,
          1,
          'expected only one POST /api/merchant-infos'
        );
      });

      test('it shows the correct error message for the user not having enough of a token to create the merchant', async function (assert) {
        sinon
          .stub(layer2Service, 'registerMerchant')
          .throws(
            new Error(
              'Prepaid card does not have enough balance to register a merchant.'
            )
          );

        await selectPrepaidCard(prepaidCardAddress);
        await click('[data-test-create-merchant-button]');
        await waitFor('[data-test-prepaid-card-choice-error-message]');

        assert
          .dom('[data-test-prepaid-card-choice-error-message]')
          .containsText(INSUFFICIENT_FUNDS_ERROR_MESSAGE);
      });

      test('it cancels the workflow if hub authentication fails', async function (assert) {
        sinon
          .stub(layer2Service, 'registerMerchant')
          .throws(new Error('No valid auth token'));

        await selectPrepaidCard(prepaidCardAddress);
        await click('[data-test-create-merchant-button]');
        await waitFor('[data-test-prepaid-card-choice-error-message]');

        assert
          .dom('[data-test-prepaid-card-choice-error-message]')
          .containsText(DEFAULT_ERROR_MESSAGE);
        assert.dom('[data-test-create-merchant-button]').isDisabled();
      });

      test('it shows a correct fallback error message', async function (assert) {
        sinon
          .stub(layer2Service, 'registerMerchant')
          .throws(new Error('Not any matched error'));

        await selectPrepaidCard(prepaidCardAddress);
        await click('[data-test-create-merchant-button]');
        await waitFor('[data-test-prepaid-card-choice-error-message]');

        assert
          .dom('[data-test-prepaid-card-choice-error-message]')
          .containsText(DEFAULT_ERROR_MESSAGE);
        assert.dom('[data-test-create-merchant-button]').isNotDisabled();
      });
    });

    module('when the Hub endpoint fails', function (hooks) {
      hooks.beforeEach(async function (this: Context) {
        this.server.post('/merchant-infos', function () {
          return new MirageResponse(500, {}, '');
        });
      });

      test('it shows the fallback error message', async function (assert) {
        await selectPrepaidCard(prepaidCardAddress);
        await click('[data-test-create-merchant-button]');
        await waitFor('[data-test-prepaid-card-choice-error-message]');

        assert
          .dom('[data-test-prepaid-card-choice-error-message]')
          .containsText(DEFAULT_ERROR_MESSAGE);
      });
    });
  }
);
