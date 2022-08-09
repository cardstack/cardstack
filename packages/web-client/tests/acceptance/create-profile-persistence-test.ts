import { module, test } from 'qunit';
import { click, visit, currentURL, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { MirageTestContext } from 'ember-cli-mirage/test-support';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';
import { buildState } from '@cardstack/web-client/models/workflow/workflow-session';
import { setupHubAuthenticationToken } from '../helpers/setup';
import {
  createDepotSafe,
  createProfileSafe,
  createPrepaidCardSafe,
  createSafeToken,
} from '@cardstack/web-client/utils/test-factories';
import {
  MILESTONE_TITLES,
  WORKFLOW_VERSION,
} from '@cardstack/web-client/components/card-pay/create-profile-workflow';

interface Context extends MirageTestContext {}

module('Acceptance | create profile persistence', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);
  setupHubAuthenticationToken(hooks);
  let workflowPersistenceService: WorkflowPersistence;
  let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
  const prepaidCardAddress = '0x81c89274Dc7C9BAcE082d2ca00697d2d2857D2eE';
  const profileName = 'Mandello';
  const profileSlug = 'mandello1';
  const profileBgColor = '#FF5050';
  const profileDID = 'did:cardstack:1pfsUmRoNRYTersTVPYgkhWE62b2cd7ce12b5fff';
  const profileAddress = '0xaeFbA62A2B3e90FD131209CC94480E722704E1F8';
  const profileRegistrationFee = 150;
  const profileSafe = createProfileSafe({
    address: profileAddress,
    profile: profileName,
    infoDID: profileDID,
    owners: [layer2AccountAddress],
  });

  hooks.beforeEach(async function () {
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;

    let depotAddress = '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666';
    layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
      createDepotSafe({
        address: depotAddress,
        owners: [layer2AccountAddress],
        tokens: [
          createSafeToken('DAI.CPXD', '250000000000000000000'),
          createSafeToken('CARD.CPXD', '250000000000000000000'),
        ],
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
    layer2Service.authenticate();
    layer2Service.test__simulateHubAuthentication('abc123--def456--ghi789');

    workflowPersistenceService = this.owner.lookup(
      'service:workflow-persistence'
    );

    workflowPersistenceService.clear();
  });

  test('Generates a flow uuid query parameter used as a persistence identifier and can be dismissed via the header button', async function (this: Context, assert) {
    await visit('/card-pay/payments');
    await click('[data-test-workflow-button="create-business"]');

    assert.strictEqual(
      // @ts-ignore (complains object is possibly null)
      new URL('http://domain.test/' + currentURL()).searchParams.get('flow-id')
        .length,
      22
    );

    await click('[data-test-return-to-dashboard]');
    assert.dom('[data-test-workflow-thread]').doesNotExist();
  });

  module('Restoring from a previously saved state', function () {
    test('it restores an unfinished workflow', async function (this: Context, assert) {
      let state = buildState({
        meta: {
          version: WORKFLOW_VERSION,
          completedCardNames: ['LAYER2_CONNECT', 'MERCHANT_CUSTOMIZATION'],
        },
        profileName,
        profileSlug,
        profileBgColor,
        profileRegistrationFee,
        prepaidCardAddress,
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'PROFILE_CREATION',
        state,
      });

      await visit('/card-pay/payments?flow=create-business&flow-id=abc123');

      assert.dom('[data-test-milestone="0"]').exists(); // L2
      assert.dom('[data-test-milestone="1"]').exists(); // Merchant info

      assert
        .dom('[data-test-prepaid-card-choice-profile-slug]')
        .containsText(profileSlug);
      assert
        .dom(
          `[data-test-boxel-card-picker-selected-card] [data-test-prepaid-card="${prepaidCardAddress}"]`
        )
        .exists();
      assert.dom('[data-test-boxel-card-picker-dropdown]').exists();
      assert.dom('[data-test-create-profile-button]').isNotDisabled();
    });

    test('it restores a finished workflow', async function (this: Context, assert) {
      const state = buildState({
        meta: {
          version: WORKFLOW_VERSION,
          completedCardNames: [
            'LAYER2_CONNECT',
            'MERCHANT_CUSTOMIZATION',
            'PREPAID_CARD_CHOICE',
          ],
        },
        profileName,
        profileSlug,
        profileBgColor,
        profile: {
          did: profileDID,
        },
        profileRegistrationFee,
        prepaidCardAddress,
        txnHash:
          '0x8bcc3e419d09a0403d1491b5bb8ac8bee7c67f85cc37e6e17ef8eb77f946497b',
        profileSafe,
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'PROFILE_CREATION',
        state,
      });

      await visit('/card-pay/payments?flow=create-business&flow-id=abc123');

      assert.dom('[data-test-milestone="0"]').exists(); // L2
      assert.dom('[data-test-milestone="1"]').exists(); // Merchant info
      assert
        .dom('[data-test-milestone-completed][data-test-milestone="2"]')
        .exists(); // Prepaid card choice
      assert.dom('[data-test-prepaid-card-choice-selected-card]').exists();
      assert.dom('[data-test-boxel-card-picker]').doesNotExist();
      assert
        .dom('[data-test-prepaid-card-choice-profile-address]')
        .containsText(profileAddress);
      assert
        .dom(
          '[data-test-prepaid-card-choice-is-complete] [data-test-boxel-button]'
        )
        .hasText('View on Blockscout');
      assert
        .dom('[data-test-epilogue][data-test-postable="0"]')
        .includesText('Congratulations! You have created a profile.');

      await click('[data-test-create-profile-next-step="dashboard"]');
      assert.dom('[data-test-workflow-thread]').doesNotExist();
    });

    test('it restores a canceled workflow', async function (this: Context, assert) {
      const state = buildState({
        meta: {
          version: WORKFLOW_VERSION,
          completedCardNames: ['LAYER2_CONNECT', 'MERCHANT_CUSTOMIZATION'],
          milestonesCount: 3,
          completedMilestonesCount: 2,
          isCanceled: true,
          cancelationReason: 'DISCONNECTED',
        },
        profileName,
        profileSlug,
        profileBgColor,
        profileRegistrationFee,
        prepaidCardAddress,
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'PROFILE_CREATION',
        state,
      });

      await visit('/card-pay/payments?flow=create-business&flow-id=abc123');

      assert.dom('[data-test-milestone="0"]').exists(); // L2
      assert.dom('[data-test-milestone="1"]').exists(); // Merchant info
      assert
        .dom('[data-test-cancelation]')
        .includesText(
          'It looks like your L2 test chain wallet got disconnected. If you still want to create a profile, please start again by connecting your wallet.'
        );

      await waitFor(
        '[data-test-workflow-default-cancelation-restart="create-business"]'
      );

      assert
        .dom(
          '[data-test-workflow-default-cancelation-restart="create-business"]'
        )
        .exists();
    });

    test('it cancels a persisted flow when trying to restore while unauthenticated', async function (this: Context, assert) {
      const state = buildState({
        meta: {
          version: WORKFLOW_VERSION,
          completedCardNames: ['LAYER2_CONNECT', 'MERCHANT_CUSTOMIZATION'],
        },
        profileName,
        profileSlug,
        profileBgColor,
        profileRegistrationFee,
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'PROFILE_CREATION',
        state,
      });

      window.TEST__AUTH_TOKEN = undefined;

      await visit('/card-pay/payments?flow=create-business&flow-id=abc123');

      assert.dom('[data-test-milestone="0"]').doesNotExist(); // L2
      assert.dom('[data-test-milestone="1"]').doesNotExist(); // Merchant info

      assert
        .dom('[data-test-cancelation]')
        .includesText(
          'You attempted to restore an unfinished workflow, but you are no longer authenticated. Please restart the workflow.'
        );

      await click('[data-test-workflow-default-cancelation-restart]');

      // Starts over
      assert.dom('[data-test-milestone="0"]').exists(); // L2
      assert.dom('[data-test-milestone="1"]').exists(); // Merchant info
      assert.dom('[data-test-milestone="2"]').doesNotExist(); // Prepaid card choice

      const workflowPersistenceId = new URL(
        'http://domain.test/' + currentURL()
      ).searchParams.get('flow-id');

      assert.notEqual(workflowPersistenceId!, 'abc123'); // flow-id param should be regenerated
      assert.strictEqual(workflowPersistenceId!.length, 22);
    });

    test('it should reset the persisted card names when editing one of the previous steps', async function (this: Context, assert) {
      const state = buildState({
        meta: {
          version: WORKFLOW_VERSION,
          completedCardNames: ['LAYER2_CONNECT', 'MERCHANT_CUSTOMIZATION'],
        },
        profileName,
        profileSlug,
        profileBgColor,
        profileRegistrationFee,
        prepaidCardAddress,
        profileSafe,
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'PROFILE_CREATION',
        state,
      });

      await visit('/card-pay/payments?flow=create-business&flow-id=abc123');
      assert.dom('[data-test-milestone="0"]').exists(); // L2
      assert.dom('[data-test-milestone="1"]').exists(); // Merchant info
      assert.dom('[data-test-milestone="2"]').exists(); // Prepaid card choice

      await waitFor('[data-test-milestone="1"] [data-test-boxel-button]');

      await click('[data-test-milestone="1"] [data-test-boxel-button]');

      await visit('/card-pay/payments?flow=create-business&flow-id=abc123');
      assert.dom('[data-test-milestone="0"]').exists(); // L2
      assert.dom('[data-test-milestone="1"]').exists(); // Merchant info
      assert.dom('[data-test-milestone="2"]').doesNotExist(); // Prepaid card choice
    });

    test('it cancels a persisted flow when card wallet address is different', async function (this: Context, assert) {
      const state = buildState({
        meta: {
          version: WORKFLOW_VERSION,
          completedCardNames: ['LAYER2_CONNECT', 'MERCHANT_CUSTOMIZATION'],
        },
        profileName,
        profileSlug,
        profileBgColor,
        profileRegistrationFee,
        layer2WalletAddress: '0xaaaaaaaaaaaaaaa', // Differs from layer2AccountAddress set in beforeEach
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'PROFILE_CREATION',
        state,
      });

      await visit('/card-pay/payments?flow=create-business&flow-id=abc123');
      assert.dom('[data-test-milestone="0"]').doesNotExist(); // L2
      assert.dom('[data-test-milestone="1"]').doesNotExist(); // Merchant info
      assert.dom('[data-test-milestone="2"]').doesNotExist(); // Prepaid card choice

      assert
        .dom('[data-test-cancelation]')
        .includesText(
          'You attempted to restore an unfinished workflow, but you changed your Cardstack Wallet address. Please restart the workflow.'
        );
    });

    test('it allows interactivity after restoring previously saved state', async function (this: Context, assert) {
      const state = buildState({
        meta: {
          version: WORKFLOW_VERSION,
          completedCardNames: ['LAYER2_CONNECT'],
        },
        profileName,
        profileSlug,
        profileBgColor,
        profileRegistrationFee,
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'PROFILE_CREATION',
        state,
      });

      await visit('/card-pay/payments?flow=create-business&flow-id=abc123');
      assert.dom('[data-test-milestone="0"]').exists(); // L2
      assert.dom('[data-test-milestone="1"]').exists(); // Merchant info
      assert.dom('[data-test-milestone="2"]').doesNotExist();

      await waitFor(`[data-test-profile="${profileName}"]`);
      await click('[data-test-profile-customization-save-details]');

      assert
        .dom('[data-test-milestone="2"] [data-test-boxel-card-container]')
        .exists();
    });

    test('it cancels a persisted flow when version is old', async function (this: Context, assert) {
      const state = buildState({
        meta: {
          version: WORKFLOW_VERSION - 1,
          completedMilestonesCount: 2,
          milestonesCount: MILESTONE_TITLES.length,
          completedCardNames: ['LAYER2_CONNECT', 'MERCHANT_CUSTOMIZATION'],
        },
        profileName,
        profileSlug,
        profileBgColor,
        profileRegistrationFee,
        prepaidCardAddress,
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'PROFILE_CREATION',
        state,
      });

      await visit('/card-pay/payments?flow=create-business&flow-id=abc123');
      assert.dom('[data-test-milestone="0"]').doesNotExist(); // L2
      assert.dom('[data-test-milestone="1"]').doesNotExist(); // Merchant info
      assert.dom('[data-test-milestone="2"]').doesNotExist(); // Prepaid card choice

      assert
        .dom('[data-test-cancelation]')
        .includesText(
          'You attempted to restore an unfinished workflow, but the workflow has been upgraded by the Cardstack development team since then, so you will need to start again. Sorry about that!'
        );
    });
  });
});
