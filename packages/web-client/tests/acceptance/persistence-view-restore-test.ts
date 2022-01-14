import { module, test } from 'qunit';
import {
  click,
  currentURL,
  fillIn,
  find,
  settled,
  triggerEvent,
  visit,
  waitFor,
  waitUntil,
} from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import percySnapshot from '@percy/ember';
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
} from '@cardstack/web-client/utils/test-factories';
import { WORKFLOW_VERSION as WITHDRAWAL_WORKFLOW_VERSION } from '@cardstack/web-client/components/card-pay/withdrawal-workflow';
import { WORKFLOW_VERSION as MERCHANT_CREATION_WORKFLOW_VERSION } from '@cardstack/web-client/components/card-pay/create-merchant-workflow';
import { WORKFLOW_VERSION as PREPAID_CARD_ISSUANCE_WORKFLOW_VERSION } from '@cardstack/web-client/components/card-pay/issue-prepaid-card-workflow';
import { WORKFLOW_VERSION as CARD_SPACE_CREATION_WORKFLOW_VERSION } from '@cardstack/web-client/components/card-space/create-space-workflow';
import Layer1TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer1';
import BN from 'bn.js';

interface Context extends MirageTestContext {}

let workflowPersistenceService: WorkflowPersistence;

module('Acceptance | persistence view and restore', function () {
  module('when the application has started', function (hooks) {
    setupApplicationTest(hooks);
    setupMirage(hooks);
    setupHubAuthenticationToken(hooks);

    hooks.beforeEach(async function (this: Context) {
      let layer1AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
      let layer1Service = this.owner.lookup('service:layer1-network')
        .strategy as Layer1TestWeb3Strategy;
      layer1Service.test__simulateAccountsChanged(
        [layer1AccountAddress],
        'metamask'
      );
      let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';

      let layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;
      let testDepot = createDepotSafe({
        address: '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666',
        tokens: [createSafeToken('CARD.CPXD', '500000000000000000000')],
      });

      layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
        testDepot,
      ]);
      await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

      let merchantRegistrationFee = await this.owner
        .lookup('service:layer2-network')
        .strategy.fetchMerchantRegistrationFee();

      layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
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

    test('it is hidden when layer1 wallet is not connected', async function (this: Context, assert) {
      await visit('/card-pay/');
      assert.dom('[data-test-workflow-tracker-toggle]').exists();

      await click('[data-test-card-pay-layer-1-connect] button');
      await click('[data-test-mainnet-disconnect-button]');

      assert.dom('[data-test-workflow-tracker-toggle]').doesNotExist();
    });

    test('it is hidden when layer2 wallet is not connected', async function (this: Context, assert) {
      await visit('/card-pay/');
      assert.dom('[data-test-workflow-tracker-toggle]').exists();

      await click('[data-test-card-pay-layer-2-connect] button');
      await click('[data-test-layer-2-wallet-disconnect-button]');

      assert.dom('[data-test-workflow-tracker-toggle]').doesNotExist();
    });

    test('it lists persisted Card Pay workflows', async function (this: Context, assert) {
      workflowPersistenceService.persistData('persisted-merchant-creation', {
        name: 'MERCHANT_CREATION',
        state: buildState({
          meta: {
            version: MERCHANT_CREATION_WORKFLOW_VERSION,
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
              version: PREPAID_CARD_ISSUANCE_WORKFLOW_VERSION,
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
            version: PREPAID_CARD_ISSUANCE_WORKFLOW_VERSION,
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
            version: PREPAID_CARD_ISSUANCE_WORKFLOW_VERSION,
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

      workflowPersistenceService.persistData('persisted-card-space-creation', {
        name: 'CARD_SPACE_CREATION',
        state: buildState({
          meta: {
            version: CARD_SPACE_CREATION_WORKFLOW_VERSION,
            completedCardNames: ['LAYER2_CONNECT'],
            completedMilestonesCount: 1,
            milestonesCount: 4,
            updatedAt: Date.UTC(2021, 8, 22, 20, 50, 18, 491).toString(),
          },
        }),
      });

      workflowPersistenceService.persistData(
        'persisted-completed-card-space-creation',
        {
          name: 'CARD_SPACE_CREATION',
          state: buildState({
            meta: {
              version: CARD_SPACE_CREATION_WORKFLOW_VERSION,
              completedCardNames: [
                'LAYER2_CONNECT',
                'CARD_SPACE_USERNAME',
                'CARD_SPACE_DETAILS',
                'CARD_SPACE_CONFIRM',
              ],
              completedMilestonesCount: 4,
              milestonesCount: 4,
              updatedAt: Date.UTC(2021, 9, 22, 20, 50, 18, 491).toString(),
            },
          }),
        }
      );

      workflowPersistenceService.persistData(
        'persisted-canceled-card-space-creation',
        {
          name: 'CARD_SPACE_CREATION',
          state: buildState({
            meta: {
              version: CARD_SPACE_CREATION_WORKFLOW_VERSION,
              completedCardNames: ['LAYER2_CONNECT'],
              completedMilestonesCount: 1,
              milestonesCount: 4,
              updatedAt: Date.UTC(2021, 7, 22, 20, 50, 18, 491).toString(),
              isCanceled: true,
              cancelationReason: 'RESTORATION_UNAUTHENTICATED',
            },
          }),
        }
      );

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
        .containsText('Business Account Creation')
        .containsText('Save business details');

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
        .dom('[data-test-completed-workflow] .boxel-progress-icon--complete')
        .exists();

      await percySnapshot(assert);

      workflowPersistenceService.clear();
      await settled();
      assert.dom('[data-test-workflow-tracker-count]').containsText('0');
    });

    test('clicking a persisted workflow restores it', async function (assert) {
      workflowPersistenceService.persistData('persisted-merchant-creation', {
        name: 'MERCHANT_CREATION',
        state: buildState({
          meta: {
            version: MERCHANT_CREATION_WORKFLOW_VERSION,
            completedCardNames: ['LAYER2_CONNECT', 'MERCHANT_CUSTOMIZATION'],
            completedMilestonesCount: 1,
            milestonesCount: 3,
          },
        }),
      });

      await visit('/card-pay/');
      await click('[data-test-workflow-tracker-toggle]');
      await click('[data-test-visit-workflow-button]');

      assert.equal(
        currentURL(),
        '/card-pay/payments?flow=create-business&flow-id=persisted-merchant-creation'
      );
    });

    test('clicking delete icon deletes the workflow', async function (assert) {
      workflowPersistenceService.persistData('persisted-merchant-creation', {
        name: 'MERCHANT_CREATION',
        state: buildState({
          meta: {
            version: MERCHANT_CREATION_WORKFLOW_VERSION,
            completedCardNames: ['LAYER2_CONNECT', 'MERCHANT_CUSTOMIZATION'],
            completedMilestonesCount: 1,
            milestonesCount: 3,
          },
        }),
      });

      await visit('/card-pay/');
      await click('[data-test-workflow-tracker-toggle]');
      await triggerEvent('[data-test-workflow-tracker-item]', 'mouseover');
      await click('[data-test-delete-workflow-button]');

      assert
        .dom('[data-test-workflow-delete-confirmation-modal] h2')
        .containsText('Abandon this workflow?');

      await click('[data-test-abandon-workflow-button]');

      assert.dom('[data-test-workflow-tracker-item]').doesNotExist();
    });

    test('completed workflows can not be deleted', async function (assert) {
      workflowPersistenceService.persistData('persisted-merchant-creation', {
        name: 'MERCHANT_CREATION',
        state: buildState({
          meta: {
            version: MERCHANT_CREATION_WORKFLOW_VERSION,
            completedCardNames: ['LAYER2_CONNECT', 'MERCHANT_CUSTOMIZATION'],
            completedMilestonesCount: 3,
            milestonesCount: 3,
          },
        }),
      });

      await visit('/card-pay/');
      await click('[data-test-workflow-tracker-toggle]');
      await triggerEvent('[data-test-workflow-tracker-item]', 'mouseover');

      assert.dom('[data-test-delete-workflow-button]').doesNotExist();
    });

    test('completed workflows can be cleared', async function (this: Context, assert) {
      workflowPersistenceService.persistData('persisted-merchant-creation', {
        name: 'MERCHANT_CREATION',
        state: buildState({
          meta: {
            version: MERCHANT_CREATION_WORKFLOW_VERSION,
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
            version: PREPAID_CARD_ISSUANCE_WORKFLOW_VERSION,
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
      await visit('/card-pay/payments');
      await click('[data-test-workflow-button="create-business"]');

      await fillIn(
        `[data-test-merchant-customization-merchant-name-field] input`,
        'Mandello'
      );
      await fillIn(
        `[data-test-merchant-customization-merchant-id-field] input`,
        'mandello1'
      );
      await waitFor('[data-test-boxel-input-validation-state="valid"]');
      await click(`[data-test-merchant-customization-save-details]`);

      assert.dom('[data-test-workflow-tracker-count]').containsText('1');

      await click('[data-test-workflow-tracker-toggle]');
      assert
        .dom('[data-test-active-workflow]:nth-child(1)')
        .containsText('Create business account');
    });

    test('a storage event causes the count to update', async function (assert) {
      await visit('/card-pay');
      assert.dom('[data-test-workflow-tracker-count]').containsText('0');

      workflowPersistenceService.__storage!.setItem(
        constructStorageKey('from-elsewhere'),
        JSON.stringify({
          name: `PREPAID_CARD_ISSUANCE`,
          state: buildState({
            meta: {
              completedCardNames: ['LAYER2_CONNECT', 'HUB_AUTH'],
              completedMilestonesCount: 1,
              milestonesCount: 4,
            },
          }),
        })
      );

      // Trigger a storage event as if from another tab
      // https://stackoverflow.com/a/60156181
      let iframe = document.createElement('iframe');
      iframe.src = 'about:blank';
      document.body.appendChild(iframe);
      iframe.contentWindow!.localStorage.setItem(
        'test-storage-event',
        new Date().getTime().toString()
      );

      await waitUntil(() => {
        return find('[data-test-workflow-tracker-count]')?.innerHTML.includes(
          '1'
        );
      });

      assert.dom('[data-test-workflow-tracker-count]').containsText('1');
    });
  });

  module(
    'when workflows have been persisted before the application loads',
    function (hooks) {
      hooks.beforeEach(function () {
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

        window.TEST__MOCK_LOCAL_STORAGE_INIT[
          constructStorageKey(`persisted-card-space-wf`)
        ] = JSON.stringify({
          name: `CARD_SPACE_CREATION`,
          state: buildState({
            meta: {
              completedCardNames: ['LAYER2_CONNECT'],
              completedMilestonesCount: 1,
              milestonesCount: 4,
            },
          }),
        });

        window.TEST__MOCK_LOCAL_STORAGE_INIT['unrelated'] = 'hello';
      });

      hooks.afterEach(function () {
        delete window.TEST__MOCK_LOCAL_STORAGE_INIT;
      });

      setupApplicationTest(hooks);
      setupMirage(hooks);
      setupHubAuthenticationToken(hooks);

      test('it is hidden before wallets are connected', async function (this: Context, assert) {
        await visit('/card-pay/');
        assert.dom('[data-test-workflow-tracker]').doesNotExist();
      });

      test('it lists existing persisted Card Pay workflows', async function (this: Context, assert) {
        let layer1AccountAddress =
          '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
        let layer1Service = this.owner.lookup('service:layer1-network')
          .strategy as Layer1TestWeb3Strategy;
        layer1Service.test__simulateAccountsChanged(
          [layer1AccountAddress],
          'metamask'
        );
        let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';

        let layer2Service = this.owner.lookup('service:layer2-network')
          .strategy as Layer2TestWeb3Strategy;
        layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

        await visit('/card-pay/');
        assert.dom('[data-test-workflow-tracker-count]').containsText('2');
      });

      test('clicking an incomplete workflow persisted with an old version opens the flow and cancels immediately', async function (this: Context, assert) {
        // @ts-ignore - defined in beforeEach
        window.TEST__MOCK_LOCAL_STORAGE_INIT[
          constructStorageKey(`persisted-old`)
        ] = JSON.stringify({
          name: `WITHDRAWAL`,
          state: buildState({
            meta: {
              version: WITHDRAWAL_WORKFLOW_VERSION - 1,
              completedCardNames: ['LAYER1_CONNECT', 'CHECK_BALANCE'],
              completedMilestonesCount: 2,
              milestonesCount: 6,
            },
          }),
        });

        let layer1AccountAddress =
          '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
        let layer1Service = this.owner.lookup('service:layer1-network')
          .strategy as Layer1TestWeb3Strategy;
        layer1Service.test__simulateAccountsChanged(
          [layer1AccountAddress],
          'metamask'
        );
        layer1Service.test__simulateBalances({
          defaultToken: new BN('2141100000000000000'),
          dai: new BN('250500000000000000000'),
          card: new BN('10000000000000000000000'),
        });

        let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';

        let layer2Service = this.owner.lookup('service:layer2-network')
          .strategy as Layer2TestWeb3Strategy;
        await layer2Service.test__simulateAccountsChanged([
          layer2AccountAddress,
        ]);

        let merchantRegistrationFee = await this.owner
          .lookup('service:layer2-network')
          .strategy.fetchMerchantRegistrationFee();

        layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
          createPrepaidCardSafe({
            address: '0x123400000000000000000000000000000000abcd',
            owners: [layer2AccountAddress],
            spendFaceValue: merchantRegistrationFee,
            prepaidCardOwner: layer2AccountAddress,
            issuer: layer2AccountAddress,
            transferrable: false,
          }),
        ]);

        await visit('/card-pay/');
        assert.dom('[data-test-workflow-tracker-count]').containsText('3');
        await click('[data-test-workflow-tracker-toggle]');
        await click('[data-test-visit-workflow-button]');

        assert
          .dom('[data-test-cancelation]')
          .includesText(
            'You attempted to restore an unfinished workflow, but the workflow has been upgraded by the Cardstack development team since then, so you will need to start again. Sorry about that!'
          );
        assert.dom('[data-test-workflow-tracker-count]').containsText('2');
      });

      test('clicking a completed workflow persisted with an old version opens the flow and cancels immediately', async function (this: Context, assert) {
        // @ts-ignore - defined in beforeEach
        window.TEST__MOCK_LOCAL_STORAGE_INIT[
          constructStorageKey(`persisted-old-complete`)
        ] = JSON.stringify({
          name: `WITHDRAWAL`,
          state: buildState({
            withdrawalToken: 'DAI.CPXD',
            withdrawnAmount: new BN('1000000000000000000'),
            layer2BlockHeightBeforeBridging: new BN('22867914'),
            minimumBalanceForWithdrawalClaim: new BN('290000000000000'),
            relayTokensTxnHash:
              '0x08ef93a1ac2911210c8e1b351dd90aa00f033b3658abdfb449eda75f84e9f501',
            bridgeValidationResult: {
              encodedData:
                '0x00050000249bfc2f3cc8d68f6b6bf7230ea0a8ed853de7310000000000000b0816a80598dd2f143cfbf091638ce3fb02c9135528366b4cc64d30849568af65522de3a68ea6cc78ce000249f00101004d2a125e4cfb0000000000000000000000004f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa000000000000000000000000511ec1515cdc483d57bc1f38e1325c221debd1e40000000000000000000000000000000000000000000000000de0b6b3a7640000',
              messageId:
                '0x00050000249bfc2f3cc8d68f6b6bf7230ea0a8ed853de7310000000000000b08',
            },
            meta: {
              version: WITHDRAWAL_WORKFLOW_VERSION - 1,
              completedMilestonesCount: 6,
              milestonesCount: 6,
              completedCardNames: [
                'LAYER1_CONNECT',
                'CHECK_BALANCE',
                'LAYER2_CONNECT',
                'CHOOSE_BALANCE',
                'TRANSACTION_AMOUNT',
                'TRANSACTION_STATUS',
                'TOKEN_CLAIM',
                'TRANSACTION_CONFIRMED',
                'EPILOGUE_LAYER_TWO_CONNECT_CARD',
              ],
            },
            didClaimTokens: true,
            withdrawalSafe: createDepotSafe({}),
          }),
        });

        let layer1AccountAddress =
          '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
        let layer1Service = this.owner.lookup('service:layer1-network')
          .strategy as Layer1TestWeb3Strategy;
        layer1Service.test__simulateAccountsChanged(
          [layer1AccountAddress],
          'metamask'
        );
        layer1Service.test__simulateBalances({
          defaultToken: new BN('2141100000000000000'),
          dai: new BN('250500000000000000000'),
          card: new BN('10000000000000000000000'),
        });

        let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';

        let layer2Service = this.owner.lookup('service:layer2-network')
          .strategy as Layer2TestWeb3Strategy;
        layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

        let merchantRegistrationFee = await this.owner
          .lookup('service:layer2-network')
          .strategy.fetchMerchantRegistrationFee();

        layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
          createDepotSafe({
            address: '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666',
            tokens: [createSafeToken('CARD.CPXD', '500000000000000000000')],
          }),
          createPrepaidCardSafe({
            address: '0x123400000000000000000000000000000000abcd',
            owners: [layer2AccountAddress],
            spendFaceValue: merchantRegistrationFee,
            prepaidCardOwner: layer2AccountAddress,
            issuer: layer2AccountAddress,
            transferrable: false,
          }),
        ]);

        await visit('/card-pay/');
        assert.dom('[data-test-workflow-tracker-count]').containsText('2');
        await click('[data-test-workflow-tracker-toggle]');
        await click(
          `[data-test-workflow-tracker-item="persisted-old-complete"] [data-test-visit-workflow-button]`
        );

        assert
          .dom('[data-test-cancelation]')
          .includesText(
            `This workflow has been upgraded by the Cardstack development team since then, so we’re not able to display it. Sorry about that!`
          );
        assert.dom('[data-test-workflow-tracker-count]').containsText('2');
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
