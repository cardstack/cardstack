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
import { WorkflowStub } from '@cardstack/web-client/tests/stubs/workflow';
import { createPrepaidCardSafe } from '@cardstack/web-client/utils/test-factories';

interface Context extends MirageTestContext {}

const USER_REJECTION_ERROR_MESSAGE =
  'It looks like you have canceled the request in your wallet. Please try again if you want to continue with this workflow.';
const TIMEOUT_ERROR_MESSAGE =
  'There was a problem creating your profile. Please contact Cardstack support to find out the status of your transaction.';
const INSUFFICIENT_FUNDS_ERROR_MESSAGE = `It looks like your prepaid card doesn't have enough funds to pay the $1.00 USD profile creation fee. Please try another prepaid card, or buy one in Cardstack Wallet.`;
const DEFAULT_ERROR_MESSAGE =
  'There was a problem creating your profile. This may be due to a network issue, or perhaps you canceled the request in your wallet. Please try again if you want to continue with this workflow, or contact Cardstack support.';

module(
  'Integration | Component | card-pay/create-profile/prepaid-card-choice',
  function (hooks) {
    let layer2Service: Layer2TestWeb3Strategy;
    let prepaidCardAddress: string;
    let prepaidCardAddress2: string;
    let workflowSession: WorkflowSession;

    setupRenderingTest(hooks);
    setupMirage(hooks);

    hooks.beforeEach(async function (this: Context) {
      layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;

      let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
      prepaidCardAddress = '0x123400000000000000000000000000000000abcd';
      prepaidCardAddress2 = '0x432100000000000000000000000000000000dbca';

      layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
        createPrepaidCardSafe({
          address: prepaidCardAddress,
          owners: [layer2AccountAddress],
          spendFaceValue: 2324,
          prepaidCardOwner: layer2AccountAddress,
          issuer: layer2AccountAddress,
        }),
        createPrepaidCardSafe({
          address: prepaidCardAddress2,
          owners: [layer2AccountAddress],
          spendFaceValue: 500,
          prepaidCardOwner: layer2AccountAddress,
          issuer: layer2AccountAddress,
        }),
      ]);

      await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

      workflowSession = new WorkflowSession();
      workflowSession.setValue({
        profileName: 'Mandello',
        profileSlug: 'mandello1',
        profileBgColor: '#ff5050',
        profileTextColor: '#fff',
        profileRegistrationFee:
          await layer2Service.fetchProfileRegistrationFee(),
      });

      this.setProperties({
        onComplete: () => {},
        onIncomplete: () => {},
        isComplete: false,
        frozen: false,
        workflowSession,
      });

      await render(hbs`
        <CardPay::CreateProfileWorkflow::PrepaidCardChoice
          @onComplete={{this.onComplete}}
          @isComplete={{this.isComplete}}
          @onIncomplete={{this.onIncomplete}}
          @workflowSession={{this.workflowSession}}
          @frozen={{this.frozen}}
        />
      `);
    });

    async function selectPrepaidCard(cardAddress: string) {
      await click(`[data-test-boxel-card-picker-dropdown]`);
      await waitFor(
        `[data-test-boxel-card-picker-dropdown] + .ember-basic-dropdown-content-wormhole-origin [data-test-card-picker-dropdown-option="${cardAddress}"]`
      );
      await click(
        `[data-test-boxel-card-picker-dropdown] + .ember-basic-dropdown-content-wormhole-origin [data-test-card-picker-dropdown-option="${cardAddress}"]`
      );
    }

    test('it shows the correct data in default state', async function (assert) {
      assert
        .dom(`[data-test-boxel-card-container]`)
        .containsText('Choose a prepaid card to pay the profile creation fee');
      assert
        .dom('[data-test-prepaid-card-choice-profile-fee]')
        .containsText('$1.00 USD');
      assert
        .dom('[data-test-profile]')
        .hasAttribute('data-test-profile', 'Mandello');
      assert
        .dom('[data-test-profile-logo]')
        .hasAttribute('data-test-profile-logo-background', '#ff5050')
        .hasAttribute('data-test-profile-logo-text-color', '#fff');
      assert
        .dom('[data-test-prepaid-card-choice-profile-slug]')
        .containsText('mandello1');
      assert
        .dom(`[data-test-boxel-action-chin] [data-test-boxel-button]`)
        .isDisabled();
      assert
        .dom(`[data-test-boxel-card-picker-dropdown]`)
        .containsText('Select Card');

      await click(`[data-test-boxel-card-picker-dropdown]`);
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
          `[data-test-boxel-card-picker-selected-card] [data-test-prepaid-card]`
        )
        .exists();
      assert
        .dom(`[data-test-boxel-card-picker-dropdown]`)
        .containsText('Change Card');
      assert
        .dom(`[data-test-boxel-action-chin] [data-test-boxel-button]`)
        .isNotDisabled();
    });

    test('it allows changing selected prepaid card', async function (assert) {
      await selectPrepaidCard(prepaidCardAddress);

      assert
        .dom(
          `[data-test-boxel-card-picker-selected-card] [data-test-prepaid-card="${prepaidCardAddress}"]`
        )
        .exists();
      assert
        .dom(`[data-test-boxel-card-picker-selected-card]`)
        .containsText(prepaidCardAddress);
      assert
        .dom(`[data-test-boxel-card-picker-selected-card]`)
        .containsText('$23.24 USD');

      await selectPrepaidCard(prepaidCardAddress2);

      assert
        .dom(
          `[data-test-boxel-card-picker-selected-card] [data-test-prepaid-card="${prepaidCardAddress2}"]`
        )
        .exists();
      assert
        .dom(`[data-test-boxel-card-picker-selected-card]`)
        .containsText(prepaidCardAddress2);
      assert
        .dom(`[data-test-boxel-card-picker-selected-card]`)
        .containsText('$5.00 USD');
    });

    test('it displays the correct data in in-progress state', async function (assert) {
      await selectPrepaidCard(prepaidCardAddress);
      await click('[data-test-create-profile-button]');
      await waitFor('[data-test-create-profile-cancel-button]');

      assert
        .dom(`[data-test-boxel-card-container]`)
        .containsText('Choose a prepaid card to pay the profile creation fee');
      assert
        .dom('[data-test-prepaid-card-choice-profile-fee]')
        .containsText('$1.00 USD');
      assert
        .dom('[data-test-prepaid-card-choice-profile-slug]')
        .containsText('mandello1');
      assert.dom(`[data-test-boxel-card-picker-dropdown]`).doesNotExist();
    });

    test('it allows canceling and retrying after a while', async function (assert) {
      assert
        .dom('[data-test-create-profile-button]')
        .containsText('Create Profile');

      await selectPrepaidCard(prepaidCardAddress);
      await click('[data-test-create-profile-button]');

      assert.dom('[data-test-create-profile-cancel-button]').doesNotExist();

      await waitFor('[data-test-create-profile-cancel-button]');
      layer2Service.test__simulateOnNonceForRegisterMerchantRequest(
        prepaidCardAddress,
        new BN('12345')
      );

      await click('[data-test-create-profile-cancel-button]');
      assert
        .dom(`[data-test-boxel-card-picker-dropdown]`)
        .containsText('Change Card');
      assert.dom('[data-test-create-profile-button]').hasText('Try Again');

      await click('[data-test-create-profile-button]');
      await waitUntil(() =>
        layer2Service.test__getNonceForRegisterMerchantRequest(
          prepaidCardAddress
        )
      );
      assert.strictEqual(
        layer2Service
          .test__getNonceForRegisterMerchantRequest(prepaidCardAddress)
          ?.toString(),
        '12345',
        'The same nonce as was used for the first attempt is sent for the second'
      );
    });

    module('Test the sdk register profile calls', function () {
      test('it can call register profile with selected prepaid card address', async function (assert) {
        let approveSpy = sinon.spy(layer2Service, 'registerProfile');

        await selectPrepaidCard(prepaidCardAddress2);
        await click('[data-test-create-profile-button]');
        await waitFor('[data-test-create-profile-cancel-button]');

        assert.ok(
          approveSpy.calledWith(prepaidCardAddress2),
          'The address that the approve call is made with matches the prepaid card selected in the UI'
        );
      });

      test('it shows the correct text in the creation button in the beginning and after errors', async function (assert) {
        sinon
          .stub(layer2Service, 'registerProfile')
          .throws(new Error('An arbitrary error'));

        assert
          .dom('[data-test-create-profile-button]')
          .containsText('Create Profile');

        await selectPrepaidCard(prepaidCardAddress);
        await click('[data-test-create-profile-button]');
        await waitFor('[data-test-prepaid-card-choice-error-message]');

        assert
          .dom('[data-test-create-profile-button]')
          .containsText('Try Again');
      });

      test('it cancels the workflow if hub authentication fails', async function (assert) {
        let workflow = new WorkflowStub(this.owner);
        workflow.attachWorkflow();
        this.set('workflowSession.workflow', workflow);

        sinon
          .stub(layer2Service, 'registerProfile')
          .throws(new Error('No valid auth token'));

        await selectPrepaidCard(prepaidCardAddress);
        await click('[data-test-create-profile-button]');
        await waitFor('[data-test-prepaid-card-choice-error-message]');

        assert
          .dom('[data-test-prepaid-card-choice-error-message]')
          .containsText(DEFAULT_ERROR_MESSAGE);

        this.set('frozen', true);
        assert.dom('[data-test-create-profile-button]').isDisabled();

        assert.true(workflow.isCanceled);
        assert.strictEqual(workflow.cancelationReason, 'UNAUTHENTICATED');
      });

      test('it shows the correct error message for a user rejection', async function (assert) {
        sinon
          .stub(layer2Service, 'registerProfile')
          .throws(new Error('User rejected request'));

        await selectPrepaidCard(prepaidCardAddress);
        await click('[data-test-create-profile-button]');
        await waitFor('[data-test-prepaid-card-choice-error-message]');

        assert
          .dom('[data-test-prepaid-card-choice-error-message]')
          .containsText(USER_REJECTION_ERROR_MESSAGE);
      });

      test('it shows the correct error message for a timeout', async function (assert) {
        sinon
          .stub(layer2Service, 'registerProfile')
          .throws(
            new Error(
              'Transaction took too long to complete, waited 30 seconds'
            )
          );

        await selectPrepaidCard(prepaidCardAddress);
        await click('[data-test-create-profile-button]');
        await waitFor('[data-test-prepaid-card-choice-error-message]');

        assert
          .dom('[data-test-prepaid-card-choice-error-message]')
          .containsText(TIMEOUT_ERROR_MESSAGE);
      });

      test('it only makes one Hub call to persist when trying again after a timeout', async function (assert) {
        let stub = sinon
          .stub(layer2Service, 'registerProfile')
          .throws(
            new Error(
              'Transaction took too long to complete, waited 30 seconds'
            )
          );

        await selectPrepaidCard(prepaidCardAddress);
        await click('[data-test-create-profile-button]');
        await waitFor('[data-test-prepaid-card-choice-error-message]');

        stub.restore();

        await click('[data-test-create-profile-button]');

        let profileStorageRequests = (
          this as any
        ).server.pretender.handledRequests.filter((req: { url: string }) =>
          req.url.includes('profiles')
        );

        assert.strictEqual(
          profileStorageRequests.length,
          1,
          'expected only one POST /api/profiles'
        );
      });

      test('it shows the correct error message for the user not having enough of a token to create the profile', async function (assert) {
        sinon
          .stub(layer2Service, 'registerProfile')
          .throws(
            new Error(
              'Prepaid card does not have enough balance to register a profile.'
            )
          );

        await selectPrepaidCard(prepaidCardAddress);
        await click('[data-test-create-profile-button]');
        await waitFor('[data-test-prepaid-card-choice-error-message]');

        assert
          .dom('[data-test-prepaid-card-choice-error-message]')
          .containsText(INSUFFICIENT_FUNDS_ERROR_MESSAGE);
      });

      test('it shows a correct fallback error message', async function (assert) {
        sinon
          .stub(layer2Service, 'registerProfile')
          .throws(new Error('Not any matched error'));

        await selectPrepaidCard(prepaidCardAddress);
        await click('[data-test-create-profile-button]');
        await waitFor('[data-test-prepaid-card-choice-error-message]');

        assert
          .dom('[data-test-prepaid-card-choice-error-message]')
          .containsText(DEFAULT_ERROR_MESSAGE);
      });

      test('it clears the txnHash stored if there is an error', async function (assert) {
        workflowSession.setValue('txnHash', 'any string');

        sinon
          .stub(layer2Service, 'resumeRegisterProfileTransaction')
          .throws(new Error("The actual error doesn't matter"));

        await selectPrepaidCard(prepaidCardAddress);
        await click('[data-test-create-profile-button]');
        await waitFor('[data-test-prepaid-card-choice-error-message]');

        assert.notOk(workflowSession.getValue('txnHash'));
      });
    });

    module('when the Hub endpoint fails', function (hooks) {
      hooks.beforeEach(async function (this: Context) {
        this.server.post('/profiles', function () {
          return new MirageResponse(500, {}, '');
        });
      });

      test('it shows the fallback error message', async function (assert) {
        await selectPrepaidCard(prepaidCardAddress);
        await click('[data-test-create-profile-button]');
        await waitFor('[data-test-prepaid-card-choice-error-message]');

        assert
          .dom('[data-test-prepaid-card-choice-error-message]')
          .containsText(DEFAULT_ERROR_MESSAGE);
      });
    });
  }
);
