import { module, test } from 'qunit';
import {
  click,
  currentURL,
  fillIn,
  find,
  settled,
  visit,
  waitUntil,
} from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { setupHubAuthenticationToken } from '../helpers/setup';

import { MirageTestContext } from 'ember-cli-mirage/test-support';
import { buildState } from '@cardstack/web-client/models/workflow/workflow-session';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';

import WorkflowPersistence, {
  constructStorageKey,
} from '@cardstack/web-client/services/workflow-persistence';
import {
  createDepotSafe,
  createPrepaidCardSafe,
  createSafeToken,
} from '../helpers/factories';

interface Context extends MirageTestContext {}

let workflowPersistenceService: WorkflowPersistence;

module('Acceptance | persistence view and restore', function () {
  module('when the application has started', function (hooks) {
    setupApplicationTest(hooks);
    setupMirage(hooks);
    setupHubAuthenticationToken(hooks);

    hooks.beforeEach(async function (this: Context) {
      let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';

      let layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;
      layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
      let testDepot = createDepotSafe({
        address: '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666',
        tokens: [createSafeToken('CARD', '500000000000000000000')],
      });

      await layer2Service.test__simulateDepot(testDepot);

      let merchantRegistrationFee = await this.owner
        .lookup('service:layer2-network')
        .strategy.fetchMerchantRegistrationFee();

      layer2Service.test__simulateAccountSafes(layer2AccountAddress, [
        createPrepaidCardSafe({
          address: '0x123400000000000000000000000000000000abcd',
          owners: [layer2AccountAddress],
          spendFaceValue: merchantRegistrationFee,
          prepaidCardOwner: layer2AccountAddress,
          issuer: layer2AccountAddress,
          transferrable: false,
        }),
      ]);

      workflowPersistenceService = this.owner.lookup(
        'service:workflow-persistence'
      );

      workflowPersistenceService.clear();
    });

    test('it lists persisted workflows', async function (this: Context, assert) {
      workflowPersistenceService.persistData('persisted-merchant-creation', {
        name: 'MERCHANT_CREATION',
        state: buildState({
          meta: {
            completedCardNames: ['LAYER2_CONNECT', 'MERCHANT_CUSTOMIZATION'],
            completedMilestonesCount: 1,
            milestonesCount: 3,
            updatedAt: Date.UTC(2020, 8, 22, 20, 50, 18, 491).toString(),
          },
        }),
      });

      workflowPersistenceService.persistData(
        'persisted-prepaid-card-issuance',
        {
          name: `PREPAID_CARD_ISSUANCE`,
          state: buildState({
            meta: {
              completedCardNames: [
                'LAYER2_CONNECT',
                'HUB_AUTH',
                'LAYOUT_CUSTOMIZATION',
                'FUNDING_SOURCE',
              ],
              completedMilestonesCount: 1,
              milestonesCount: 4,
              updatedAt: Date.UTC(2020, 10, 22, 20, 50, 18, 491).toString(),
            },
          }),
        }
      );

      workflowPersistenceService.persistData('persisted-complete-issuance', {
        name: 'PREPAID_CARD_ISSUANCE',
        state: buildState({
          meta: {
            completedCardNames: [
              'LAYER2_CONNECT',
              'HUB_AUTH',
              'LAYOUT_CUSTOMIZATION',
              'FUNDING_SOURCE',
              'FACE_VALUE',
              'PREVIEW',
              'CONFIRMATION',
              'EPILOGUE_LAYER_TWO_CONNECT_CARD',
            ],
            completedMilestonesCount: 4,
            milestonesCount: 4,
          },
        }),
      });

      workflowPersistenceService.persistData('unknown', {
        name: 'UNKNOWN',
        state: buildState({}),
      });

      workflowPersistenceService.persistData('unknown-with-meta', {
        name: 'UNKNOWN',
        state: buildState({ meta: {} }),
      });

      workflowPersistenceService.persistData('canceled', {
        name: `PREPAID_CARD_ISSUANCE`,
        state: buildState({
          meta: {
            completedCardNames: [
              'LAYER2_CONNECT',
              'HUB_AUTH',
              'LAYOUT_CUSTOMIZATION',
              'FUNDING_SOURCE',
            ],
            completedMilestonesCount: 1,
            milestonesCount: 4,
            updatedAt: Date.UTC(2020, 10, 22, 20, 50, 18, 491).toString(),
            isCanceled: true,
            cancelationReason: 'RESTORATION_UNAUTHENTICATED',
          },
        }),
      });

      await visit('/card-pay/');
      assert.dom('[data-test-workflow-tracker-count]').containsText('2');

      await click('[data-test-workflow-tracker-toggle]');
      assert.dom('[data-test-active-workflow]').exists({ count: 2 });
      assert.dom('[data-test-active-workflow-count]').containsText('2');

      assert
        .dom('[data-test-active-workflow]:nth-child(1)')
        .containsText(
          'Prepaid Card Issuance',
          'expected the most-recently-updated workflow to show first'
        )
        .containsText('Customize layout');

      assert
        .dom('[data-test-active-workflow]:nth-child(2)')
        .containsText('Merchant Creation')
        .containsText('Save merchant details');

      assert.equal(
        getProgressIconCompletion(
          '[data-test-active-workflow]:nth-child(1) .boxel-progress-icon'
        ),
        0.25
      );

      assert.dom('[data-test-completed-workflow]').exists({ count: 1 });
      assert.dom('[data-test-completed-workflow-count]').containsText('1');

      assert
        .dom('[data-test-completed-workflow]')
        .containsText('Prepaid Card Issuance')
        .containsText('Complete');

      assert
        .dom('[data-test-completed-workflow] button')
        .isDisabled('expected a completed workflow button to be disabled');

      assert
        .dom('[data-test-completed-workflow] .boxel-progress-icon--complete')
        .exists();

      workflowPersistenceService.clear();
      await settled();
      assert.dom('[data-test-workflow-tracker-count]').containsText('0');
    });

    test('clicking a persisted workflow restores it', async function (assert) {
      workflowPersistenceService.persistData('persisted-merchant-creation', {
        name: 'MERCHANT_CREATION',
        state: buildState({
          meta: {
            completedCardNames: ['LAYER2_CONNECT', 'MERCHANT_CUSTOMIZATION'],
            completedMilestonesCount: 1,
            milestonesCount: 3,
          },
        }),
      });

      await visit('/card-pay/');
      await click('[data-test-workflow-tracker-toggle]');
      await click('[data-test-active-workflow] button');

      assert.equal(
        currentURL(),
        '/card-pay/merchant-services?flow=create-merchant&flow-id=persisted-merchant-creation'
      );
    });

    test('completed workflows can be cleared', async function (this: Context, assert) {
      workflowPersistenceService.persistData('persisted-merchant-creation', {
        name: 'MERCHANT_CREATION',
        state: buildState({
          meta: {
            completedCardNames: ['LAYER2_CONNECT', 'MERCHANT_CUSTOMIZATION'],
            completedMilestonesCount: 1,
            milestonesCount: 3,
          },
        }),
      });

      workflowPersistenceService.persistData('persisted-complete-issuance', {
        name: 'PREPAID_CARD_ISSUANCE',
        state: buildState({
          meta: {
            completedCardNames: [
              'LAYER2_CONNECT',
              'HUB_AUTH',
              'LAYOUT_CUSTOMIZATION',
              'FUNDING_SOURCE',
              'FACE_VALUE',
              'PREVIEW',
              'CONFIRMATION',
              'EPILOGUE_LAYER_TWO_CONNECT_CARD',
            ],
            completedMilestonesCount: 4,
            milestonesCount: 4,
          },
        }),
      });

      await visit('/card-pay/');

      await click('[data-test-workflow-tracker-toggle]');
      assert.dom('[data-test-active-workflow]').exists({ count: 1 });
      assert.dom('[data-test-completed-workflow]').exists({ count: 1 });

      await click('[data-test-workflow-tracker-clear-completed]');
      assert.dom('[data-test-completed-workflow]').doesNotExist();
      assert.dom('[data-test-workflow-tracker-clear-completed]').doesNotExist();
    });

    test('opening a workflow only increments the counter by one and shows the correct milestone', async function (assert) {
      await visit('/card-pay/merchant-services');
      await click('[data-test-workflow-button="create-merchant"]');

      await fillIn(
        `[data-test-merchant-customization-merchant-name-field] input`,
        'Mandello'
      );
      await fillIn(
        `[data-test-merchant-customization-merchant-id-field] input`,
        'mandello1'
      );
      await waitUntil(
        () =>
          (
            document.querySelector(
              '[data-test-validation-state-input]'
            ) as HTMLElement
          ).dataset.testValidationStateInput === 'valid'
      );
      await click(`[data-test-merchant-customization-save-details]`);

      assert.dom('[data-test-workflow-tracker-count]').containsText('1');

      await click('[data-test-workflow-tracker-toggle]');
      assert
        .dom('[data-test-active-workflow]:nth-child(1)')
        .containsText('Create merchant');
    });

    // FIXME add test for storage event coming from another tab
  });

  module(
    'when workflows have been persisted before the application loads',
    function (hooks) {
      window.TEST__MOCK_LOCAL_STORAGE_INIT = {};

      for (let i = 0; i < 2; i++) {
        window.TEST__MOCK_LOCAL_STORAGE_INIT[
          constructStorageKey(`persisted-${i}`)
        ] = JSON.stringify({
          name: `PREPAID_CARD_ISSUANCE`,
          state: buildState({
            meta: {
              completedCardNames: ['LAYER2_CONNECT', 'HUB_AUTH'],
              completedMilestonesCount: 1,
              milestonesCount: 4,
            },
          }),
        });
      }

      window.TEST__MOCK_LOCAL_STORAGE_INIT['unrelated'] = 'hello';

      setupApplicationTest(hooks);
      setupMirage(hooks);
      setupHubAuthenticationToken(hooks);

      test('it lists existing persisted workflows', async function (this: Context, assert) {
        await visit('/card-pay/');
        assert.dom('[data-test-workflow-tracker-count]').containsText('2');
      });

      hooks.afterEach(function () {
        delete window.TEST__MOCK_LOCAL_STORAGE_INIT;
      });
    }
  );
});

// The progress icon completion proportion can be derived from a style attribute
function getProgressIconCompletion(selector: string) {
  let progressIconElement = find(selector);
  let progressStyle = progressIconElement
    ?.querySelector('.boxel-progress-icon__progress-pie')
    ?.getAttribute('style');
  let [dashFractionNumerator, dashFractionDenominator] = progressStyle!
    .split(':')[1]
    .split(' ');
  return (
    parseFloat(dashFractionNumerator) / parseFloat(dashFractionDenominator)
  );
}
