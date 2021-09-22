import { module, test } from 'qunit';
import { click, visit, currentURL, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { MirageTestContext } from 'ember-cli-mirage/test-support';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';
import { MerchantSafe, PrepaidCardSafe } from '@cardstack/cardpay-sdk';
import { buildState } from '@cardstack/web-client/models/workflow/workflow-session';

interface Context extends MirageTestContext {}

module('Acceptance | create merchant persistence', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);
  let workflowPersistenceService: WorkflowPersistence;
  let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
  const prepaidCardAddress = '0x81c89274Dc7C9BAcE082d2ca00697d2d2857D2eE';
  const prepaidCard: PrepaidCardSafe = {
    type: 'prepaid-card',
    address: prepaidCardAddress,
    customizationDID: 'did:cardstack:1pkYh9uJHdfMJZt4mURGmhps96b157a2d744efd9',
    reloadable: false,
    spendFaceValue: 500,
    transferrable: true,
    createdAt: Date.now() / 1000,
    tokens: [],
    owners: [layer2AccountAddress],
    issuingToken: '0xTOKEN',
    prepaidCardOwner: layer2AccountAddress,
    hasBeenUsed: false,
    issuer: layer2AccountAddress,
  };
  const merchantName = 'Mandello';
  const merchantId = 'mandello1';
  const merchantBgColor = '#FF5050';
  const merchantDID = 'did:cardstack:1pfsUmRoNRYTersTVPYgkhWE62b2cd7ce12b5fff';
  const merchantAddress = '0xaeFbA62A2B3e90FD131209CC94480E722704E1F8';
  const merchantRegistrationFee = 150;
  const merchantSafe: MerchantSafe = {
    type: 'merchant',
    address: merchantAddress,
    merchant: merchantName,
    infoDID: merchantDID,
    accumulatedSpendValue: 0,
    createdAt: Date.now(),
    tokens: [],
    owners: [layer2AccountAddress],
  };

  hooks.beforeEach(async function () {
    window.TEST__AUTH_TOKEN = 'abc123--def456--ghi789';
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

    let depotAddress = '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666';
    layer2Service.test__simulateAccountSafes(layer2AccountAddress, [
      {
        type: 'depot',
        address: depotAddress,
        tokens: [
          {
            balance: '250000000000000000000',
            tokenAddress: 'DAI_ADDRESS',
            token: {
              symbol: 'DAI',
              name: 'DAI',
              decimals: 18,
            },
          },
          {
            balance: '250000000000000000000',
            tokenAddress: 'CARD_ADDRESS',
            token: {
              symbol: 'CARD',
              name: 'CARD',
              decimals: 18,
            },
          },
        ],
        createdAt: Date.now() / 1000,
        owners: [layer2AccountAddress],
      },
      {
        type: 'prepaid-card',
        createdAt: Date.now() / 1000,

        address: '0x123400000000000000000000000000000000abcd',

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
    layer2Service.authenticate();
    layer2Service.test__simulateHubAuthentication('abc123--def456--ghi789');

    workflowPersistenceService = this.owner.lookup(
      'service:workflow-persistence'
    );

    workflowPersistenceService.storage.clear();
  });

  hooks.afterEach(async function () {
    delete window.TEST__AUTH_TOKEN;
  });

  test('Generates a flow uuid query parameter used as a persistence identifier', async function (this: Context, assert) {
    await visit('/card-pay/merchant-services');
    await click('[data-test-workflow-button="create-merchant"]');

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
        completedCardNames: ['LAYER2_CONNECT', 'MERCHANT_CUSTOMIZATION'],
        merchantName,
        merchantId,
        merchantBgColor,
        merchantRegistrationFee,
        prepaidCardChoice: prepaidCard,
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'MERCHANT_CREATION',
        state,
      });

      await visit(
        '/card-pay/merchant-services?flow=create-merchant&flow-id=abc123'
      );

      assert.dom('[data-test-milestone="0"]').exists(); // L2
      assert.dom('[data-test-milestone="1"]').exists(); // Merchant info

      assert
        .dom('[data-test-prepaid-card-choice-merchant-id]')
        .containsText(merchantId);
      assert
        .dom(
          `[data-test-prepaid-card-choice-selected-card] [data-test-prepaid-card="${prepaidCardAddress}"]`
        )
        .exists();
      assert.dom('[data-test-card-picker-dropdown]').exists();
      assert.dom('[data-test-create-merchant-button]').isNotDisabled();
    });

    test('it restores a finished workflow', async function (this: Context, assert) {
      const state = buildState({
        completedCardNames: [
          'LAYER2_CONNECT',
          'MERCHANT_CUSTOMIZATION',
          'PREPAID_CARD_CHOICE',
        ],
        merchantName,
        merchantId,
        merchantBgColor,
        merchantInfo: {
          did: merchantDID,
        },
        merchantRegistrationFee,
        prepaidCardChoice: prepaidCard,
        txnHash:
          '0x8bcc3e419d09a0403d1491b5bb8ac8bee7c67f85cc37e6e17ef8eb77f946497b',
        merchantSafe,
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'MERCHANT_CREATION',
        state,
      });

      await visit(
        '/card-pay/merchant-services?flow=create-merchant&flow-id=abc123'
      );

      assert.dom('[data-test-milestone="0"]').exists(); // L2
      assert.dom('[data-test-milestone="1"]').exists(); // Merchant info
      assert
        .dom('[data-test-milestone-completed][data-test-milestone="2"]')
        .exists(); // Prepaid card choice
      assert
        .dom('[data-test-prepaid-card-choice-merchant-address]')
        .containsText(merchantAddress);
      assert
        .dom(
          '[data-test-prepaid-card-choice-is-complete] [data-test-boxel-button]'
        )
        .hasText('View on Blockscout');
      assert
        .dom('[data-test-epilogue][data-test-postable="0"]')
        .includesText('Congratulations! You have created a merchant.');

      await click('[data-test-create-merchant-next-step="dashboard"]');
      assert.dom('[data-test-workflow-thread]').doesNotExist();
    });

    test('it restores a cancelled workflow', async function (this: Context, assert) {
      const state = buildState({
        cancelationReason: 'DISCONNECTED',
        completedCardNames: ['LAYER2_CONNECT', 'MERCHANT_CUSTOMIZATION'],
        merchantName,
        merchantId,
        merchantBgColor,
        merchantRegistrationFee,
        prepaidCardChoice: prepaidCard,
        completedMilestonesCount: 2,
        isCancelled: true,
        milestonesCount: 3,
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'MERCHANT_CREATION',
        state,
      });

      await visit(
        '/card-pay/merchant-services?flow=create-merchant&flow-id=abc123'
      );

      assert.dom('[data-test-milestone="0"]').exists(); // L2
      assert.dom('[data-test-milestone="1"]').exists(); // Merchant info
      assert
        .dom('[data-test-cancelation]')
        .includesText(
          'It looks like your L2 test chain wallet got disconnected. If you still want to create a merchant, please start again by connecting your wallet.'
        );

      await waitFor(
        '[data-test-workflow-default-cancelation-restart="create-merchant"]'
      );

      assert
        .dom(
          '[data-test-workflow-default-cancelation-restart="create-merchant"]'
        )
        .exists();
    });

    test('it cancels a persisted flow when trying to restore while unauthenticated', async function (this: Context, assert) {
      const state = buildState({
        completedCardNames: ['LAYER2_CONNECT', 'MERCHANT_CUSTOMIZATION'],
        merchantName,
        merchantId,
        merchantBgColor,
        merchantRegistrationFee,
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'MERCHANT_CREATION',
        state,
      });

      window.TEST__AUTH_TOKEN = undefined;

      await visit(
        '/card-pay/merchant-services?flow=create-merchant&flow-id=abc123'
      );

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
      assert.equal(workflowPersistenceId!.length, 22);
    });

    test('it should reset the persisted card names when editing one of the previous steps', async function (this: Context, assert) {
      const state = buildState({
        completedCardNames: ['LAYER2_CONNECT', 'MERCHANT_CUSTOMIZATION'],
        merchantName,
        merchantId,
        merchantBgColor,
        merchantRegistrationFee,
        prepaidCardChoice: prepaidCard,
        txnHash:
          '0x8bcc3e419d09a0403d1491b5bb8ac8bee7c67f85cc37e6e17ef8eb77f946497b',
        merchantSafe,
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'MERCHANT_CREATION',
        state,
      });

      await visit(
        '/card-pay/merchant-services?flow=create-merchant&flow-id=abc123'
      );
      assert.dom('[data-test-milestone="0"]').exists(); // L2
      assert.dom('[data-test-milestone="1"]').exists(); // Merchant info
      assert.dom('[data-test-milestone="2"]').exists(); // Prepaid card choice

      await waitFor('[data-test-milestone="1"] [data-test-boxel-button]');

      await click('[data-test-milestone="1"] [data-test-boxel-button]');

      await visit(
        '/card-pay/merchant-services?flow=create-merchant&flow-id=abc123'
      );
      assert.dom('[data-test-milestone="0"]').exists(); // L2
      assert.dom('[data-test-milestone="1"]').exists(); // Merchant info
      assert.dom('[data-test-milestone="2"]').doesNotExist(); // Prepaid card choice
    });

    test('it cancels a persisted flow when card wallet address is different', async function (this: Context, assert) {
      const state = buildState({
        completedCardNames: ['LAYER2_CONNECT', 'MERCHANT_CUSTOMIZATION'],
        merchantName,
        merchantId,
        merchantBgColor,
        merchantRegistrationFee,
        layer2WalletAddress: '0xaaaaaaaaaaaaaaa', // Differs from layer2AccountAddress set in beforeEach
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'MERCHANT_CREATION',
        state,
      });

      await visit(
        '/card-pay/merchant-services?flow=create-merchant&flow-id=abc123'
      );
      assert.dom('[data-test-milestone="0"]').doesNotExist(); // L2
      assert.dom('[data-test-milestone="1"]').doesNotExist(); // Merchant info
      assert.dom('[data-test-milestone="2"]').doesNotExist(); // Prepaid card choice

      assert
        .dom('[data-test-cancelation]')
        .includesText(
          'You attempted to restore an unfinished workflow, but you changed your Card wallet adress. Please restart the workflow.'
        );
    });

    test('it allows interactivity after restoring previously saved state', async function (this: Context, assert) {
      const state = buildState({
        completedCardNames: ['LAYER2_CONNECT'],
        merchantName,
        merchantId,
        merchantBgColor,
        merchantRegistrationFee,
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'MERCHANT_CREATION',
        state,
      });

      await visit(
        '/card-pay/merchant-services?flow=create-merchant&flow-id=abc123'
      );
      assert.dom('[data-test-milestone="0"]').exists(); // L2
      assert.dom('[data-test-milestone="1"]').exists(); // Merchant info
      assert.dom('[data-test-milestone="2"]').doesNotExist();

      await waitFor(`[data-test-merchant="${merchantName}"]`);
      await click('[data-test-merchant-customization-save-details]');

      assert
        .dom('[data-test-milestone="2"] [data-test-boxel-card-container]')
        .exists();
    });
  });
});
