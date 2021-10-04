import { module, test } from 'qunit';
import { click, visit, currentURL, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';

import { setupMirage } from 'ember-cli-mirage/test-support';
import prepaidCardColorSchemes from '../../mirage/fixture-data/prepaid-card-color-schemes';
import prepaidCardPatterns from '../../mirage/fixture-data/prepaid-card-patterns';

import { MirageTestContext } from 'ember-cli-mirage/test-support';
import { BN } from 'bn.js';
import { faceValueOptions } from '@cardstack/web-client/components/card-pay/issue-prepaid-card-workflow/workflow-config';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { toWei } from 'web3-utils';

import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';
import { buildState } from '@cardstack/web-client/models/workflow/workflow-session';
import { setupHubAuthenticationToken } from '../helpers/setup';
import {
  createDepotSafe,
  createPrepaidCardSafe,
  createSafeToken,
} from '@cardstack/web-client/utils/test-factories';

interface Context extends MirageTestContext {}

module('Acceptance | issue prepaid card persistence', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);
  setupHubAuthenticationToken(hooks);
  let workflowPersistenceService: WorkflowPersistence;

  hooks.beforeEach(async function (this: Context) {
    this.server.db.loadData({
      prepaidCardColorSchemes,
      prepaidCardPatterns,
    });
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    const MIN_AMOUNT_TO_PASS = new BN(
      toWei(`${Math.ceil(Math.min(...faceValueOptions) / 100)}`)
    );
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    let testDepot = createDepotSafe({
      address: '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666',
      tokens: [
        createSafeToken('DAI', MIN_AMOUNT_TO_PASS.toString()),
        createSafeToken('CARD', '500000000000000000000'),
      ],
    });

    await layer2Service.test__simulateDepot(testDepot);
    layer2Service.authenticate();
    layer2Service.test__simulateHubAuthentication('abc123--def456--ghi789');

    workflowPersistenceService = this.owner.lookup(
      'service:workflow-persistence'
    );

    workflowPersistenceService.clear();
  });

  test('Generates a flow uuid query parameter used as a persistence identifier', async function (this: Context, assert) {
    await visit('/card-pay');
    await click('[data-test-workflow-button="issue-prepaid-card"]');

    assert.equal(
      // @ts-ignore (complains object is possibly null)
      new URL('http://domain.test/' + currentURL()).searchParams.get('flow-id')
        .length,
      22
    );
  });

  module('Restoring from a previously saved state', function () {
    test('it restores an unfinished workflow', async function (this: Context, assert) {
      let state = buildState({
        meta: {
          completedCardNames: [
            'LAYER2_CONNECT',
            'LAYOUT_CUSTOMIZATION',
            'FUNDING_SOURCE',
            'FACE_VALUE',
          ],
        },
        issuerName: 'Vitalik',
        pattern: {
          patternUrl:
            '/assets/images/prepaid-card-customizations/pattern-3-89f3b92e275536a92558d500a3dc9e4d.svg',
          id: '80cb8f99-c5f7-419e-9c95-2e87a9d8db32',
        },
        colorScheme: {
          patternColor: 'white',
          textColor: 'black',
          background: '#37EB77',
          id: '4f219852-33ee-4e4c-81f7-76318630a423',
        },
        prepaidFundingToken: 'DAI.CPXD',
        spendFaceValue: 10000,
        did: 'did:cardstack:1pfsUmRoNRYTersTVPYgkhWE62b2cd7ce12b578e',
        prepaidCardAddress: '0xaeFbA62A2B3e90FD131209CC94480E722704E1F8',
        reloadable: true,
        transferrable: true,
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'PREPAID_CARD_ISSUANCE',
        state,
      });

      await visit('/card-pay/balances?flow=issue-prepaid-card&flow-id=abc123');

      assert.dom('[data-test-milestone="0"]').exists(); // L2
      assert.dom('[data-test-milestone="1"]').exists(); // Customize layout
      assert.dom('[data-test-milestone="2"]').exists(); // Choose face value
      assert.dom('[data-test-milestone="3"]').exists(); // Prepaid card preview

      assert
        .dom(
          '[data-test-preview] [data-test-prepaid-card-issuer-name-labeled-value]'
        )
        .hasText('Issued by Vitalik');

      assert
        .dom('[data-test-preview] [data-test-prepaid-card-balance]')
        .hasText('§10,000');

      assert.dom('[data-test-issue-prepaid-card-button]').hasText('Create'); // Create prepaid card CTA
    });

    test('it restores a finished workflow', async function (this: Context, assert) {
      let state = buildState({
        meta: {
          completedCardNames: [
            'LAYER2_CONNECT',
            'LAYOUT_CUSTOMIZATION',
            'FUNDING_SOURCE',
            'FACE_VALUE',
            'PREVIEW', // Includes all milestone cards
          ],
        },
        issuerName: 'Vitalik',
        pattern: {
          patternUrl:
            '/assets/images/prepaid-card-customizations/pattern-3-89f3b92e275536a92558d500a3dc9e4d.svg',
          id: '80cb8f99-c5f7-419e-9c95-2e87a9d8db32',
        },
        colorScheme: {
          patternColor: 'white',
          textColor: 'black',
          background: '#37EB77',
          id: '4f219852-33ee-4e4c-81f7-76318630a423',
        },
        prepaidFundingToken: 'DAI.CPXD',
        spendFaceValue: 10000,
        did: 'did:cardstack:1pfsUmRoNRYTersTVPYgkhWE62b2cd7ce12b578e',
        prepaidCardAddress: '0x81c89274Dc7C9BAcE082d2ca00697d2d2857D2eE',
        reloadable: true,
        transferrable: true,
        txHash:
          '0x8bcc3e419d09a0403d1491b5bb8ac8bee7c67f85cc37e6e17ef8eb77f946497b',
        prepaidCardSafe: createPrepaidCardSafe({
          address: '0x81c89274Dc7C9BAcE082d2ca00697d2d2857D2eE',
          customizationDID:
            'did:cardstack:1pkYh9uJHdfMJZt4mURGmhps96b157a2d744efd9',
          spendFaceValue: 500,
        }),
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'Prepaid Card Issuance',
        state,
      });

      await visit('/card-pay/balances?flow=issue-prepaid-card&flow-id=abc123');

      assert.dom('[data-test-milestone="0"]').exists(); // L2
      assert.dom('[data-test-milestone="1"]').exists(); // Customize layout
      assert.dom('[data-test-milestone="2"]').exists(); // Choose funding source
      assert.dom('[data-test-milestone="3"]').exists(); // Prepaid card issues
      assert
        .dom('[data-test-epilogue][data-test-postable="1"]')
        .includesText('Prepaid card issued');

      assert.dom('[data-test-layer-2-wallet-summary]').exists();

      await click('[data-test-issue-prepaid-card-next-step="new-issuance"]');

      // Starts over
      assert.dom('[data-test-milestone="0"]').exists(); // L2
      assert.dom('[data-test-milestone="1"]').exists(); // Customize layout
      assert.dom('[data-test-milestone="2"]').doesNotExist(); // Choose funding source
    });

    test('it restores a canceled workflow', async function (this: Context, assert) {
      let state = buildState({
        colorScheme: {
          patternColor: 'black',
          textColor: 'white',
          background: '#FF5050',
          description: 'Sunset Orange',
        },
        meta: {
          completedCardNames: [
            'LAYER2_CONNECT',
            'HUB_AUTH',
            'LAYOUT_CUSTOMIZATION',
            'FUNDING_SOURCE',
            'FACE_VALUE',
          ],
          milestonesCount: 4,
          completedMilestonesCount: 3,
          isCanceled: true,
          cancelationReason: 'DISCONNECTED',
        },
        issuerName: 'Peter',
        pattern: {
          patternUrl:
            'https://app.cardstack.com/images/prepaid-card-customizations/pattern-1.svg',
        },
        prepaidFundingToken: 'DAI.CPXD',
        spendFaceValue: 500,
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'Prepaid Card Issuance',
        state,
      });

      await visit('/card-pay/balances?flow=issue-prepaid-card&flow-id=abc123');

      assert.dom('[data-test-milestone="0"]').exists(); // L2
      assert.dom('[data-test-milestone="1"]').exists(); // Customize layout
      assert.dom('[data-test-milestone="2"]').exists(); // Choose face value
      assert.dom('[data-test-milestone="3"]').exists(); // Prepaid card preview

      assert
        .dom('[data-test-cancelation]')
        .includesText(
          'It looks like your L2 test chain wallet got disconnected. If you still want to create a prepaid card, please start again by connecting your wallet.'
        );

      // TODO: reveal cancellation message immediately
      await waitFor(
        '[data-test-workflow-default-cancelation-restart="issue-prepaid-card"]'
      );

      assert
        .dom(
          '[data-test-workflow-default-cancelation-restart="issue-prepaid-card"]'
        )
        .exists();
    });

    test('it cancels a persisted flow when trying to restore while unauthenticated', async function (this: Context, assert) {
      let state = buildState({
        meta: {
          completedCardNames: [
            'LAYER2_CONNECT',
            'LAYOUT_CUSTOMIZATION',
            'FUNDING_SOURCE',
            'FACE_VALUE',
          ],
        },
        issuerName: 'Vitalik',
        pattern: {
          patternUrl:
            '/assets/images/prepaid-card-customizations/pattern-3-89f3b92e275536a92558d500a3dc9e4d.svg',
          id: '80cb8f99-c5f7-419e-9c95-2e87a9d8db32',
        },
        colorScheme: {
          patternColor: 'white',
          textColor: 'black',
          background: '#37EB77',
          id: '4f219852-33ee-4e4c-81f7-76318630a423',
        },
        prepaidFundingToken: 'DAI.CPXD',
        spendFaceValue: 10000,
        did: 'did:cardstack:1pfsUmRoNRYTersTVPYgkhWE62b2cd7ce12b578e',
        prepaidCardAddress: '0xaeFbA62A2B3e90FD131209CC94480E722704E1F8',
        reloadable: true,
        transferrable: true,
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'PREPAID_CARD_ISSUANCE',
        state,
      });

      window.TEST__AUTH_TOKEN = undefined;

      await visit('/card-pay/balances?flow=issue-prepaid-card&flow-id=abc123');

      assert.dom('[data-test-milestone="0"]').doesNotExist(); // L2
      assert.dom('[data-test-milestone="1"]').doesNotExist(); // Customize layout
      assert.dom('[data-test-milestone="2"]').doesNotExist(); // Choose funding source

      assert
        .dom('[data-test-cancelation]')
        .includesText(
          'You attempted to restore an unfinished workflow, but you are no longer authenticated. Please restart the workflow.'
        );

      await click('[data-test-workflow-default-cancelation-restart]');

      // Starts over
      assert.dom('[data-test-milestone="0"]').exists(); // L2
      assert.dom('[data-test-milestone="1"]').exists(); // Customize layout
      assert.dom('[data-test-milestone="2"]').doesNotExist(); // Choose funding source

      const workflowPersistenceId = new URL(
        'http://domain.test/' + currentURL()
      ).searchParams.get('flow-id');

      assert.notEqual(workflowPersistenceId!, 'abc123'); // flow-id param should be regenerated
      assert.equal(workflowPersistenceId!.length, 22);
    });

    test('it should reset the persisted card names when editing one of the previous steps', async function (this: Context, assert) {
      let state = buildState({
        meta: {
          completedCardNames: [
            'LAYER2_CONNECT',
            'LAYOUT_CUSTOMIZATION',
            'FUNDING_SOURCE',
            'FACE_VALUE',
          ],
        },
        issuerName: 'Vitalik',
        pattern: {
          patternUrl:
            '/assets/images/prepaid-card-customizations/pattern-3-89f3b92e275536a92558d500a3dc9e4d.svg',
          id: '80cb8f99-c5f7-419e-9c95-2e87a9d8db32',
        },
        colorScheme: {
          patternColor: 'white',
          textColor: 'black',
          background: '#37EB77',
          id: '4f219852-33ee-4e4c-81f7-76318630a423',
        },
        prepaidFundingToken: 'DAI.CPXD',
        spendFaceValue: 10000,
        did: 'did:cardstack:1pfsUmRoNRYTersTVPYgkhWE62b2cd7ce12b578e',
        prepaidCardAddress: '0x81c89274Dc7C9BAcE082d2ca00697d2d2857D2eE',
        reloadable: true,
        transferrable: true,
        txHash:
          '0x8bcc3e419d09a0403d1491b5bb8ac8bee7c67f85cc37e6e17ef8eb77f946497b',
        prepaidCardSafe: createPrepaidCardSafe({
          address: '0x81c89274Dc7C9BAcE082d2ca00697d2d2857D2eE',
          customizationDID:
            'did:cardstack:1pkYh9uJHdfMJZt4mURGmhps96b157a2d744efd9',
          spendFaceValue: 500,
        }),
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'PREPAID_CARD_ISSUANCE',
        state,
      });

      await visit('/card-pay/balances?flow=issue-prepaid-card&flow-id=abc123');
      assert.dom('[data-test-milestone="0"]').exists(); // L2
      assert.dom('[data-test-milestone="1"]').exists(); // Customize layout
      assert.dom('[data-test-milestone="2"]').exists(); // Choose face value
      assert.dom('[data-test-milestone="3"]').exists(); // Prepaid card preview

      await waitFor('[data-test-milestone="1"] [data-test-boxel-button]');

      await click('[data-test-milestone="1"] [data-test-boxel-button]');

      await visit('/card-pay/balances?flow=issue-prepaid-card&flow-id=abc123');

      assert.dom('[data-test-milestone="0"]').exists(); // L2
      assert.dom('[data-test-milestone="1"]').exists(); // Customize layout
      assert.dom('[data-test-milestone="2"]').doesNotExist(); // Choose face value
      assert.dom('[data-test-milestone="3"]').doesNotExist(); // Prepaid card preview
    });

    test('it cancels a persisted flow when card wallet address is different', async function (this: Context, assert) {
      let state = buildState({
        meta: {
          completedCardNames: [
            'LAYER2_CONNECT',
            'LAYOUT_CUSTOMIZATION',
            'FUNDING_SOURCE',
            'FACE_VALUE',
          ],
        },
        issuerName: 'Vitalik',
        pattern: {
          patternUrl:
            '/assets/images/prepaid-card-customizations/pattern-3-89f3b92e275536a92558d500a3dc9e4d.svg',
          id: '80cb8f99-c5f7-419e-9c95-2e87a9d8db32',
        },
        colorScheme: {
          patternColor: 'white',
          textColor: 'black',
          background: '#37EB77',
          id: '4f219852-33ee-4e4c-81f7-76318630a423',
        },
        prepaidFundingToken: 'DAI.CPXD',
        spendFaceValue: 10000,
        did: 'did:cardstack:1pfsUmRoNRYTersTVPYgkhWE62b2cd7ce12b578e',
        prepaidCardAddress: '0xaeFbA62A2B3e90FD131209CC94480E722704E1F8',
        reloadable: true,
        transferrable: true,
        layer2WalletAddress: '0xaaaaaaaaaaaaaaa', // Differs from layer2AccountAddress set in beforeEach
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'PREPAID_CARD_ISSUANCE',
        state,
      });

      await visit('/card-pay/balances?flow=issue-prepaid-card&flow-id=abc123');

      assert.dom('[data-test-milestone="0"]').doesNotExist(); // L2
      assert.dom('[data-test-milestone="1"]').doesNotExist(); // Customize layout
      assert.dom('[data-test-milestone="2"]').doesNotExist(); // Choose funding source

      assert
        .dom('[data-test-cancelation]')
        .includesText(
          'You attempted to restore an unfinished workflow, but you changed your Card wallet address. Please restart the workflow.'
        );
    });

    test('it allows interactivity after restoring previously saved state', async function (this: Context, assert) {
      let state = buildState({
        meta: {
          completedCardNames: ['LAYER2_CONNECT', 'LAYOUT_CUSTOMIZATION'],
        },
        issuerName: 'Vitalik',
        pattern: {
          patternUrl:
            '/assets/images/prepaid-card-customizations/pattern-3-89f3b92e275536a92558d500a3dc9e4d.svg',
          id: '80cb8f99-c5f7-419e-9c95-2e87a9d8db32',
        },
        colorScheme: {
          patternColor: 'white',
          textColor: 'black',
          background: '#37EB77',
          id: '4f219852-33ee-4e4c-81f7-76318630a423',
        },
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'Prepaid Card Issuance',
        state,
      });

      await visit('/card-pay/balances?flow=issue-prepaid-card&flow-id=abc123');

      assert.dom('[data-test-milestone="0"]').exists(); // L2
      assert.dom('[data-test-milestone="1"]').exists(); // Customize layout
      assert.dom('[data-test-milestone="2"]').exists(); // Choose funding source

      assert.dom('[data-test-funding-source-card]').exists();
      assert.dom('[data-test-face-value-card]').doesNotExist();

      await click(
        '[data-test-funding-source-card] [data-test-boxel-action-chin] [data-test-boxel-button]'
      );

      assert.dom('[data-test-face-value-card]').exists();
    });
  });
});
