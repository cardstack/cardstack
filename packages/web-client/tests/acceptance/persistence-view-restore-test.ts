import { module, test } from 'qunit';
import { click, settled, visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';

import { setupMirage } from 'ember-cli-mirage/test-support';
import prepaidCardColorSchemes from '../../mirage/fixture-data/prepaid-card-color-schemes';
import prepaidCardPatterns from '../../mirage/fixture-data/prepaid-card-patterns';

import { MirageTestContext } from 'ember-cli-mirage/test-support';
import { DepotSafe } from '@cardstack/cardpay-sdk';
import { BN } from 'bn.js';
import { faceValueOptions } from '@cardstack/web-client/components/card-pay/issue-prepaid-card-workflow/workflow-config';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { toWei } from 'web3-utils';

import WorkflowPersistence, {
  STORAGE_KEY_PREFIX,
} from '@cardstack/web-client/services/workflow-persistence';

interface Context extends MirageTestContext {}

let workflowPersistenceService: WorkflowPersistence;

async function setupEverythingFIXME(context: Context) {
  context.server.db.loadData({
    prepaidCardColorSchemes,
    prepaidCardPatterns,
  });
  window.TEST__AUTH_TOKEN = 'abc123--def456--ghi789';
  let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';

  // FIXME what of the below and above is unnecessary?

  const MIN_AMOUNT_TO_PASS = new BN(
    toWei(`${Math.ceil(Math.min(...faceValueOptions) / 100)}`)
  );
  let layer2Service = context.owner.lookup('service:layer2-network')
    .strategy as Layer2TestWeb3Strategy;
  layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
  let testDepot = {
    address: '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666',
    tokens: [
      {
        balance: MIN_AMOUNT_TO_PASS.toString(),
        token: {
          symbol: 'DAI',
        },
      },
      {
        balance: '500000000000000000000',
        token: {
          symbol: 'CARD',
        },
      },
    ],
  };
  await layer2Service.test__simulateDepot(testDepot as DepotSafe);
  layer2Service.authenticate();
  layer2Service.test__simulateHubAuthentication('abc123--def456--ghi789');

  workflowPersistenceService = context.owner.lookup(
    'service:workflow-persistence'
  );
}

module('Acceptance | persistence view and restore', function () {
  module('when things have been constructed FIXME lol', function (hooks) {
    setupApplicationTest(hooks);
    setupMirage(hooks);

    hooks.beforeEach(async function (this: Context) {
      await setupEverythingFIXME(this);
      workflowPersistenceService.clear();
    });

    test('it lists persisted workflows', async function (this: Context, assert) {
      workflowPersistenceService.persistData('persisted-merchant-creation', {
        name: 'MERCHANT_CREATION',
        state: {
          completedCardNames: ['LAYER2_CONNECT', 'MERCHANT_CUSTOMIZATION'],
          completedMilestonesCount: 1,
          milestonesCount: 3,
        },
      });

      workflowPersistenceService.persistData(
        'persisted-prepaid-card-issuance',
        {
          name: `PREPAID_CARD_ISSUANCE`,
          state: {
            completedCardNames: [
              'LAYER2_CONNECT',
              'HUB_AUTH',
              'LAYOUT_CUSTOMIZATION',
              'FUNDING_SOURCE',
            ],
            completedMilestonesCount: 1,
            milestonesCount: 4,
          },
        }
      );

      workflowPersistenceService.persistData('persisted-complete-issuance', {
        name: 'PREPAID_CARD_ISSUANCE',
        state: {
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
      });

      await visit('/card-pay/');
      assert.dom('[data-test-workflow-tracker]').containsText('2');

      await click('[data-test-workflow-tracker-toggle]');
      assert.dom('[data-test-active-workflow]').exists({ count: 2 });

      assert
        .dom('[data-test-active-workflow]:nth-child(1)')
        .containsText('Merchant Creation');

      assert
        .dom('[data-test-active-workflow]:nth-child(2)')
        .containsText('Prepaid Card Issuance');

      assert.dom('[data-test-completed-workflow]').exists({ count: 1 });

      workflowPersistenceService.clear();
      await settled();
      assert.dom('[data-test-workflow-tracker]').containsText('0');
    });

    // FIXME add test for storage event coming from another tab
  });

  module(
    'when workflows have been persisted before the application loads',
    function () {
      window.TEST__MOCK_LOCAL_STORAGE_INIT = {};

      for (let i = 0; i < 2; i++) {
        window.TEST__MOCK_LOCAL_STORAGE_INIT[
          `${STORAGE_KEY_PREFIX}:persisted-${i}`
        ] = JSON.stringify({
          name: `PREPAID_CARD_ISSUANCE`,
          state: {
            completedCardNames: ['LAYER2_CONNECT', 'HUB_AUTH'],
            completedMilestonesCount: 1,
            milestonesCount: 4,
          },
        });
      }

      window.TEST__MOCK_LOCAL_STORAGE_INIT['unrelated'] = 'hello';

      module('wha', function (hooks) {
        setupApplicationTest(hooks);
        setupMirage(hooks);

        hooks.beforeEach(async function (this: Context) {
          await setupEverythingFIXME(this);
        });

        test('it lists existing persisted workflows', async function (this: Context, assert) {
          await visit('/card-pay/');
          assert.dom('[data-test-workflow-tracker]').containsText('2');
        });

        hooks.afterEach(function () {
          delete window.TEST__MOCK_LOCAL_STORAGE_INIT;
        });
      });
    }
  );
});
