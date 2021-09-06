import { module, test } from 'qunit';
import { click, visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';

import { setupMirage } from 'ember-cli-mirage/test-support';
import prepaidCardColorSchemes from '../../mirage/fixture-data/prepaid-card-color-schemes';
import prepaidCardPatterns from '../../mirage/fixture-data/prepaid-card-patterns';

import { MirageTestContext } from 'ember-cli-mirage/test-support';

interface Context extends MirageTestContext {}

module('Acceptance | issue prepaid card', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(function () {
    // TODO: fix typescript for mirage
    (this as any).server.db.loadData({
      prepaidCardColorSchemes,
      prepaidCardPatterns,
    });
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

  module('Restoring from previously saved state', function () {
    test('it restores the workflow', async function (this: Context, assert) {
      const state = {
        completedCardNames: [
          'LAYER2_CONNECT',
          'LAYOUT_CUSTOMIZATION',
          'FUNDING_SOURCE',
          'FACE_VALUE',
        ],
        issuerName: 'Vitalik',
        pattern: {
          patternUrl:
            '/assets/images/prepaid-card-customizations/pattern-3-be5bfc96d028c4ed55a5aafca645d213.svg',
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
      };

      localStorage.setItem(
        `workflowPersistence:123`,
        JSON.stringify({
          name: 'Prepaid Card Issuance',
          state,
        })
      );

      // FIXME: Route never resolves, possibly due to the testwaiter in the animated workflow
      await visit('/card-pay/balances?flow=issue-prepaid-card&flow-id=123');

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
        .hasText('§10000');
    });
  });
});
