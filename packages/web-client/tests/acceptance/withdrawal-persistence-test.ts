import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';

import { setupMirage } from 'ember-cli-mirage/test-support';

import { MirageTestContext } from 'ember-cli-mirage/test-support';

import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';
import { click, currentURL, visit, waitFor } from '@ember/test-helpers';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import Layer1TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer1';
import { BN } from 'bn.js';
import { buildState } from '@cardstack/web-client/models/workflow/workflow-session';

interface Context extends MirageTestContext {}

module('Acceptance | withdrawal persistence', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);
  let workflowPersistenceService: WorkflowPersistence;

  hooks.beforeEach(function () {
    workflowPersistenceService = this.owner.lookup(
      'service:workflow-persistence'
    );

    let layer1AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
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

    workflowPersistenceService.storage.clear();
  });

  test('Generates a flow uuid query parameter used as a persistence identifier', async function (this: Context, assert) {
    await visit('/card-pay/token-suppliers');
    await click('[data-test-workflow-button="withdrawal"]');
    assert.equal(
      new URL('http://domain.test/' + currentURL()).searchParams.get('flow-id')
        ?.length,
      22
    );
  });

  module('Restoring from a previously saved state', function () {
    test('it restores an unfinished workflow', async function (this: Context, assert) {
      const state = buildState({
        withdrawalToken: 'DAI.CPXD',
        withdrawnAmount: new BN('1000000000000000000'),
        completedMilestonesCount: 5,
        layer2BlockHeightBeforeBridging: new BN('22867914'),
        milestonesCount: 6,
        minimumBalanceForWithdrawalClaim: new BN('290000000000000'),
        relayTokensTxnHash:
          '0x08ef93a1ac2911210c8e1b351dd90aa00f033b3658abdfb449eda75f84e9f501',
        bridgeValidationResult: {
          encodedData:
            '0x00050000249bfc2f3cc8d68f6b6bf7230ea0a8ed853de7310000000000000b0816a80598dd2f143cfbf091638ce3fb02c9135528366b4cc64d30849568af65522de3a68ea6cc78ce000249f00101004d2a125e4cfb0000000000000000000000004f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa000000000000000000000000511ec1515cdc483d57bc1f38e1325c221debd1e40000000000000000000000000000000000000000000000000de0b6b3a7640000',
          messageId:
            '0x00050000249bfc2f3cc8d68f6b6bf7230ea0a8ed853de7310000000000000b08',
        },
        withdrawalSafe: {
          type: 'depot',
          address: '0x2Fe77303eBc9F6375852bBEe1bd43FC0fa1e7B08',
          tokens: [
            {
              balance: '1000000000000000000',
              token: {
                name: 'CARD Token Kovan.CPXD',
                symbol: 'CARD',
                decimals: 18,
              },
              tokenAddress: '0xB236ca8DbAB0644ffCD32518eBF4924ba866f7Ee',
            },
            {
              balance: '4215997042758579167',
              token: {
                name: 'Dai Stablecoin.CPXD',
                symbol: 'DAI',
                decimals: 18,
              },
              tokenAddress: '0xFeDc0c803390bbdA5C4C296776f4b574eC4F30D1',
            },
          ],
        },
        meta: {
          completedCardNames: [
            'LAYER1_CONNECT',
            'CHECK_BALANCE',
            'LAYER2_CONNECT',
            'CHOOSE_BALANCE',
            'TRANSACTION_AMOUNT',
            'TRANSACTION_STATUS',
          ],
          createdAt: '1627908405',
        },
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'WITHDRAWAL',
        state,
      });

      await visit('/card-pay/token-suppliers?flow=withdrawal&flow-id=abc123');

      assert.dom('[data-test-milestone="0"]').exists(); // L1
      assert.dom('[data-test-milestone="1"]').exists(); // Check ETH balance
      assert.dom('[data-test-milestone="2"]').exists(); // Connect L2 wallet
      assert.dom('[data-test-milestone="3"]').exists(); // Withdraw from L2
      assert.dom('[data-test-milestone="4"]').exists(); // Bridge to L1
      assert.dom('[data-test-milestone="5"]').exists(); // Claim

      assert.dom('[data-test-claim-button]').exists();

      assert
        .dom('[data-test-milestone="5"] [data-test-balance-display-amount]')
        .hasText('1.00 DAI.CPXD');

      assert
        .dom('[data-test-withdrawal-next-step="new-withdrawal"]')
        .doesNotExist();
    });

    test('it restores a finished workflow', async function (this: Context, assert) {
      const state = buildState({
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
        withdrawalSafe: {
          type: 'depot',
          address: '0x2Fe77303eBc9F6375852bBEe1bd43FC0fa1e7B08',
          createdAt: 1627908405,
          tokens: [
            {
              balance: '1000000000000000000',
              token: {
                name: 'CARD Token Kovan.CPXD',
                symbol: 'CARD',
                decimals: 18,
              },
              tokenAddress: '0xB236ca8DbAB0644ffCD32518eBF4924ba866f7Ee',
            },
            {
              balance: '4215997042758579167',
              token: {
                name: 'Dai Stablecoin.CPXD',
                symbol: 'DAI',
                decimals: 18,
              },
              tokenAddress: '0xFeDc0c803390bbdA5C4C296776f4b574eC4F30D1',
            },
          ],
        },
        meta: {
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
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'WITHDRAWAL',
        state,
      });

      await visit('/card-pay/token-suppliers?flow=withdrawal&flow-id=abc123');

      assert.dom('[data-test-milestone="0"]').exists(); // L1
      assert.dom('[data-test-milestone="1"]').exists(); // Check ETH balance
      assert.dom('[data-test-milestone="2"]').exists(); // Connect L2 wallet
      assert.dom('[data-test-milestone="3"]').exists(); // Withdraw from L2
      assert.dom('[data-test-milestone="4"]').exists(); // Bridge to L1
      assert.dom('[data-test-milestone="5"]').exists(); // Claim

      assert.dom('[data-test-claim-button]').doesNotExist();

      assert
        .dom(
          '[data-test-withdrawal-transaction-confirmed-from] [data-test-balance-display-amount]'
        )
        .hasText('1.00 DAI.CPXD');
      assert
        .dom(
          '[data-test-withdrawal-transaction-confirmed-to] [data-test-balance-display-amount]'
        )
        .hasText('1.00 DAI');

      assert.dom('[data-test-withdrawal-next-step="new-withdrawal"]').exists();
    });

    test('it restores a cancelled workflow', async function (this: Context, assert) {
      const state = buildState({
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
        withdrawalSafe: {
          type: 'depot',
          address: '0x2Fe77303eBc9F6375852bBEe1bd43FC0fa1e7B08',
          createdAt: 1627908405,
          tokens: [
            {
              balance: '1000000000000000000',
              token: {
                name: 'CARD Token Kovan.CPXD',
                symbol: 'CARD',
                decimals: 18,
              },
              tokenAddress: '0xB236ca8DbAB0644ffCD32518eBF4924ba866f7Ee',
            },
            {
              balance: '4215997042758579167',
              token: {
                name: 'Dai Stablecoin.CPXD',
                symbol: 'DAI',
                decimals: 18,
              },
              tokenAddress: '0xFeDc0c803390bbdA5C4C296776f4b574eC4F30D1',
            },
          ],
        },
        meta: {
          completedMilestonesCount: 5,
          milestonesCount: 6,
          completedCardNames: [
            'LAYER1_CONNECT',
            'CHECK_BALANCE',
            'LAYER2_CONNECT',
            'CHOOSE_BALANCE',
            'TRANSACTION_AMOUNT',
            'TRANSACTION_STATUS',
          ],
          isCancelled: true,
          cancelationReason: 'DISCONNECTED',
        },
      });
      workflowPersistenceService.persistData('abc123', {
        name: 'WITHDRAWAL',
        state,
      });
      await visit('/card-pay/token-suppliers?flow=withdrawal&flow-id=abc123');
      assert.dom('[data-test-milestone="0"]').exists(); // L1
      assert.dom('[data-test-milestone="1"]').exists(); // Check ETH balance
      assert.dom('[data-test-milestone="2"]').exists(); // Connect L2 wallet
      assert.dom('[data-test-milestone="3"]').exists(); // Withdraw from L2
      assert.dom('[data-test-milestone="4"]').exists(); // Bridge to L1

      assert
        .dom('[data-test-cancelation]')
        .includesText(
          'It looks like your wallet(s) got disconnected. If you still want to withdraw tokens, please start again by connecting your wallet(s).'
        );

      await waitFor(
        '[data-test-workflow-default-cancelation-restart="withdrawal"]'
      );
      assert
        .dom('[data-test-workflow-default-cancelation-restart="withdrawal"]')
        .exists();
    });

    test('it cancels a persisted flow when Layer 1 wallet address is different', async function (this: Context, assert) {
      const state = buildState({
        meta: {
          completedCardNames: [
            'LAYER1_CONNECT',
            'CHECK_BALANCE',
            'LAYER2_CONNECT',
            'CHOOSE_BALANCE',
            'TRANSACTION_AMOUNT',
            'TRANSACTION_STATUS',
          ],
        },
        layer1WalletAddress: '0xaaaaaaaaaaaaaaa', // Differs from layer1WalletAddress set in beforeEach
      });
      workflowPersistenceService.persistData('abc123', {
        name: 'WITHDRAWAL',
        state,
      });
      await visit('/card-pay/token-suppliers?flow=deposit&flow-id=abc123');
      assert.dom('[data-test-milestone="0"]').doesNotExist();
      assert.dom('[data-test-milestone="1"]').doesNotExist();
      assert.dom('[data-test-milestone="2"]').doesNotExist();
      assert.dom('[data-test-milestone="3"]').doesNotExist();
      assert.dom('[data-test-milestone="4"]').doesNotExist();
      assert
        .dom('[data-test-cancelation]')
        .includesText(
          'You attempted to restore an unfinished workflow, but you changed your Layer 1 wallet adress. Please restart the workflow.'
        );
    });

    test('it cancels a persisted flow when card wallet address is different', async function (this: Context, assert) {
      const state = buildState({
        meta: {
          completedCardNames: [
            'LAYER1_CONNECT',
            'CHECK_BALANCE',
            'LAYER2_CONNECT',
            'CHOOSE_BALANCE',
            'TRANSACTION_AMOUNT',
            'TRANSACTION_STATUS',
          ],
        },
        layer2WalletAddress: '0xaaaaaaaaaaaaaaa', // Differs from layer2WalletAddress set in beforeEach
      });
      workflowPersistenceService.persistData('abc123', {
        name: 'WITHDRAWAL',
        state,
      });
      await visit('/card-pay/token-suppliers?flow=deposit&flow-id=abc123');
      assert.dom('[data-test-milestone="0"]').doesNotExist();
      assert.dom('[data-test-milestone="1"]').doesNotExist();
      assert.dom('[data-test-milestone="2"]').doesNotExist();
      assert.dom('[data-test-milestone="3"]').doesNotExist();
      assert.dom('[data-test-milestone="4"]').doesNotExist();
      assert
        .dom('[data-test-cancelation]')
        .includesText(
          'You attempted to restore an unfinished workflow, but you changed your Card wallet adress. Please restart the workflow.'
        );
    });

    test('it restores the workflow when restoring during bridging', async function (this: Context, assert) {
      const state = buildState({
        withdrawalToken: 'DAI.CPXD',
        withdrawnAmount: new BN('1000000000000000000'),
        layer2BlockHeightBeforeBridging: new BN('22867914'),
        minimumBalanceForWithdrawalClaim: new BN('290000000000000'),
        relayTokensTxnHash:
          '0x08ef93a1ac2911210c8e1b351dd90aa00f033b3658abdfb449eda75f84e9f501',
        withdrawalSafe: {
          type: 'depot',
          address: '0x2Fe77303eBc9F6375852bBEe1bd43FC0fa1e7B08',
          createdAt: 1627908405,
          tokens: [
            {
              balance: '1000000000000000000',
              token: {
                name: 'CARD Token Kovan.CPXD',
                symbol: 'CARD',
                decimals: 18,
              },
              tokenAddress: '0xB236ca8DbAB0644ffCD32518eBF4924ba866f7Ee',
            },
            {
              balance: '4215997042758579167',
              token: {
                name: 'Dai Stablecoin.CPXD',
                symbol: 'DAI',
                decimals: 18,
              },
              tokenAddress: '0xFeDc0c803390bbdA5C4C296776f4b574eC4F30D1',
            },
          ],
        },
        meta: {
          completedMilestonesCount: 5,
          milestonesCount: 6,
          completedCardNames: [
            'LAYER1_CONNECT',
            'CHECK_BALANCE',
            'LAYER2_CONNECT',
            'CHOOSE_BALANCE',
            'TRANSACTION_AMOUNT',
          ],
        },
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'WITHDRAWAL',
        state,
      });

      let layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;

      layer2Service.bridgeToLayer1('0xsource', '0xdestination', 'DAI', '20');
      layer2Service.test__simulateBridgedToLayer1();
      await visit('/card-pay/token-suppliers?flow=withdrawal&flow-id=abc123');

      assert.dom('[data-test-milestone="0"]').exists(); // L1
      assert.dom('[data-test-milestone="1"]').exists(); // Check ETH balance
      assert.dom('[data-test-milestone="2"]').exists(); // Connect L2 wallet
      assert.dom('[data-test-milestone="3"]').exists(); // Withdraw from L2
      assert.dom('[data-test-milestone="4"]').exists(); // Bridge to L1
      assert.dom('[data-test-milestone="5"]').exists(); // Claim

      assert.dom('[data-test-claim-button]').exists();

      assert.true(
        JSON.parse(
          workflowPersistenceService.getPersistedData('abc123').state.meta
        ).value.completedCardNames.includes('TRANSACTION_STATUS') // Did complete
      );
    });
  });
});
