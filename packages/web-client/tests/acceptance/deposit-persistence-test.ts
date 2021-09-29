import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';

import { setupMirage } from 'ember-cli-mirage/test-support';

import { MirageTestContext } from 'ember-cli-mirage/test-support';

import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';
import {
  click,
  currentURL,
  settled,
  visit,
  waitFor,
} from '@ember/test-helpers';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import Layer1TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer1';
import { BN } from 'bn.js';
import { buildState } from '@cardstack/web-client/models/workflow/workflow-session';

interface Context extends MirageTestContext {}

module('Acceptance | deposit persistence', function (hooks) {
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

    workflowPersistenceService.clear();
  });

  test('Generates a flow uuid query parameter used as a persistence identifier', async function (this: Context, assert) {
    await visit('/card-pay/token-suppliers');
    await click('[data-test-workflow-button="deposit"]');
    assert.equal(
      new URL('http://domain.test/' + currentURL()).searchParams.get('flow-id')
        ?.length,
      22
    );
  });

  module('Restoring from a previously saved state', function () {
    test('it restores an unfinished workflow', async function (this: Context, assert) {
      const state = buildState({
        meta: {
          completedCardNames: ['LAYER1_CONNECT', 'LAYER2_CONNECT', 'TXN_SETUP'],
        },
        depositSourceToken: 'DAI',
        depositedAmount: new BN('10000000000000000000'),
      });
      workflowPersistenceService.persistData('abc123', {
        name: 'RESERVE_POOL_DEPOSIT',
        state,
      });
      await visit('/card-pay/token-suppliers?flow=deposit&flow-id=abc123');
      assert.dom('[data-test-milestone="0"]').exists(); // L1
      assert.dom('[data-test-milestone="1"]').exists(); // L2
      assert.dom('[data-test-milestone="2"]').exists(); // Deposit
      assert
        .dom(
          '[data-test-deposit-transaction-setup-is-complete] [data-test-balance-display-amount]'
        )
        .hasText('250.50 DAI');
      assert.dom('[data-test-token-amount-input]').hasValue('10');
      assert.dom('[data-test-unlock-button]').hasText('Unlock');
    });

    test('it restores a workflow partway through the deposit/unlock 2-step process', async function (this: Context, assert) {
      const state = buildState({
        meta: {
          completedCardNames: ['LAYER1_CONNECT', 'LAYER2_CONNECT', 'TXN_SETUP'],
        },
        depositSourceToken: 'DAI',
        depositedAmount: new BN('10000000000000000000'),
        unlockTxnHash: '0xABC',
        unlockTxnReceipt: {
          status: true,
          transactionHash: '0xABC',
          transactionIndex: 1,
          blockHash: '',
          blockNumber: 1,
          from: '',
          to: '',
          contractAddress: '',
          cumulativeGasUsed: 1,
          gasUsed: 1,
          logs: [],
          logsBloom: '',
          events: {},
        },
        relayTokensTxnHash: '0xDEF',
      });
      workflowPersistenceService.persistData('abc123', {
        name: 'RESERVE_POOL_DEPOSIT',
        state,
      });
      await visit('/card-pay/token-suppliers?flow=deposit&flow-id=abc123');
      assert.dom('[data-test-milestone="0"]').exists(); // L1
      assert.dom('[data-test-milestone="1"]').exists(); // L2
      assert.dom('[data-test-milestone="2"]').exists(); // Deposit
      assert.dom('[data-test-milestone="3"]').doesNotExist(); // Receive

      assert
        .dom(
          `[data-test-transaction-amount-container] [data-test-unlock-etherscan-button]`
        )
        .exists({ count: 1 });
      assert
        .dom(
          '[data-test-transaction-amount-container] [data-test-deposit-button]'
        )
        .hasText('Depositing');

      let layer1Service = this.owner.lookup('service:layer1-network')
        .strategy as Layer1TestWeb3Strategy;
      layer1Service.test__simulateDeposit();
      await settled();
    });

    test('it restores a workflow partway through the layer 2 bridging', async function (this: Context, assert) {
      const state = buildState({
        meta: {
          completedCardNames: [
            'LAYER1_CONNECT',
            'LAYER2_CONNECT',
            'TXN_SETUP',
            'TXN_AMOUNT',
          ],
        },
        depositSourceToken: 'DAI',
        depositedAmount: new BN('10000000000000000000'),
        unlockTxnHash: '0xABC',
        unlockTxnReceipt: {
          status: true,
          transactionHash: '0xABC',
          transactionIndex: 1,
          blockHash: '',
          blockNumber: 1,
          from: '',
          to: '',
          contractAddress: '',
          cumulativeGasUsed: 1,
          gasUsed: 1,
          logs: [],
          logsBloom: '',
          events: {},
        },
        relayTokensTxnHash: '0xDEF',
        relayTokensTxnReceipt: {
          status: true,
          transactionHash: '0xDEF',
          transactionIndex: 1,
          blockHash: '',
          blockNumber: 1,
          from: '',
          to: '',
          contractAddress: '',
          cumulativeGasUsed: 1,
          gasUsed: 1,
          logs: [],
          logsBloom: '',
          events: {},
        },
        layer2BlockHeightBeforeBridging: '1234',
      });
      workflowPersistenceService.persistData('abc123', {
        name: 'RESERVE_POOL_DEPOSIT',
        state,
      });
      await visit('/card-pay/token-suppliers?flow=deposit&flow-id=abc123');
      assert.dom('[data-test-milestone="0"]').exists(); // L1
      assert.dom('[data-test-milestone="1"]').exists(); // L2
      assert.dom('[data-test-milestone="2"]').exists(); // Deposit
      assert.dom('[data-test-milestone="3"]').exists(); // Receive

      assert
        .dom(`[data-test-deposit-transaction-status-card]`)
        .containsText('Bridging tokens to L2 blockchain');

      let layer1Service = this.owner.lookup('service:layer1-network')
        .strategy as Layer1TestWeb3Strategy;
      let layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;
      await waitFor(`[data-test-token-bridge-step="0"][data-test-completed]`);
      layer1Service.test__simulateBlockConfirmation();
      await settled();
      layer1Service.test__simulateBlockConfirmation();
      await settled();
      layer1Service.test__simulateBlockConfirmation();
      await settled();

      layer2Service.test__simulateBridgedToLayer2(
        '0xabc123abc123abc123e5984131f6b4cc3ac8af14'
      );
      await waitFor(`[data-test-token-bridge-step="1"][data-test-completed]`);
      await waitFor(`[data-test-token-bridge-step="2"][data-test-completed]`);
      await settled();
      assert.dom(`[data-test-bridge-explorer-button]`).exists();
    });

    test('it restores a finished workflow', async function (this: Context, assert) {
      const state = buildState({
        meta: {
          completedCardNames: [
            'LAYER1_CONNECT',
            'LAYER2_CONNECT',
            'TXN_SETUP',
            'TXN_AMOUNT',
            'TXN_STATUS',
          ],
        },
        depositSourceToken: 'DAI',
        depositedAmount: new BN('10000000000000000000'),
        unlockTxnHash: '0xABC',
        unlockTxnReceipt: {
          status: true,
          transactionHash: '0xABC',
          transactionIndex: 1,
          blockHash: '',
          blockNumber: 1,
          from: '',
          to: '',
          contractAddress: '',
          cumulativeGasUsed: 1,
          gasUsed: 1,
          logs: [],
          logsBloom: '',
          events: {},
        },
        relayTokensTxnHash: '0xDEF',
        relayTokensTxnReceipt: {
          status: true,
          transactionHash: '0xDEF',
          transactionIndex: 1,
          blockHash: '',
          blockNumber: 1,
          from: '',
          to: '',
          contractAddress: '',
          cumulativeGasUsed: 1,
          gasUsed: 1,
          logs: [],
          logsBloom: '',
          events: {},
        },
        layer2BlockHeightBeforeBridging: '1234',
        completedLayer2TxnReceipt: {
          status: true,
          transactionHash: '0xGHI',
          transactionIndex: 1,
          blockHash: '',
          blockNumber: 1,
          from: '',
          to: '',
          contractAddress: '',
          cumulativeGasUsed: 1,
          gasUsed: 1,
          logs: [],
          logsBloom: '',
          events: {},
        },
      });
      workflowPersistenceService.persistData('abc123', {
        name: 'RESERVE_POOL_DEPOSIT',
        state,
      });
      await visit('/card-pay/token-suppliers?flow=deposit&flow-id=abc123');
      assert.dom('[data-test-milestone="0"]').exists(); // L1
      assert.dom('[data-test-milestone="1"]').exists(); // L2
      assert.dom('[data-test-milestone="2"]').exists(); // Deposit
      assert.dom('[data-test-milestone="3"]').exists(); // Receive
      assert
        .dom('[data-test-epilogue] [data-test-deposit-confirmation]')
        .includesText('Locked in CARD Protocol reserve pool');
      assert.dom('[data-test-layer-1-wallet-summary]').exists();

      await click('[data-test-deposit-next-step="new-deposit"]');
      // Starts over
      assert.dom('[data-test-milestone="0"]').exists(); // L1
      assert.dom('[data-test-milestone="1"]').exists(); // L2
      assert.dom('[data-test-milestone="2"]').exists(); // Deposit
      assert.dom('[data-test-milestone="3"]').doesNotExist(); // Receive
    });

    test('it restores a cancelled workflow', async function (this: Context, assert) {
      const state = buildState({
        meta: {
          completedCardNames: ['LAYER1_CONNECT', 'LAYER2_CONNECT', 'TXN_SETUP'],
          isCancelled: true,
          cancelationReason: 'DISCONNECTED',
        },
        depositSourceToken: 'DAI',
        depositedAmount: new BN('10000000000000000000'),
      });
      workflowPersistenceService.persistData('abc123', {
        name: 'RESERVE_POOL_DEPOSIT',
        state,
      });
      await visit('/card-pay/token-suppliers?flow=deposit&flow-id=abc123');
      assert.dom('[data-test-milestone="0"]').exists(); // L1
      assert.dom('[data-test-milestone="1"]').exists(); // L2
      assert.dom('[data-test-milestone="2"]').exists(); // Deposit
      assert
        .dom('[data-test-cancelation]')
        .includesText(
          'It looks like your wallet(s) got disconnected. If you still want to deposit funds, please start again by connecting your wallet(s).'
        );
      // TODO: reveal cancellation message immediately
      await waitFor(
        '[data-test-workflow-default-cancelation-restart="deposit"]'
      );
      assert
        .dom('[data-test-workflow-default-cancelation-restart="deposit"]')
        .exists();
    });

    test('it should reset the persisted card names when editing one of the previous steps', async function (this: Context, assert) {
      const state = buildState({
        meta: {
          completedCardNames: ['LAYER1_CONNECT', 'LAYER2_CONNECT', 'TXN_SETUP'],
        },
        depositSourceToken: 'DAI',
        depositedAmount: new BN('10000000000000000000'),
      });
      workflowPersistenceService.persistData('abc123', {
        name: 'RESERVE_POOL_DEPOSIT',
        state,
      });
      await visit('/card-pay/token-suppliers?flow=deposit&flow-id=abc123');
      assert.dom('[data-test-milestone="0"]').exists(); // L1
      assert.dom('[data-test-milestone="1"]').exists(); // L2
      assert.dom('[data-test-deposit-transaction-setup-container]').exists();
      assert.dom('[data-test-transaction-amount-container]').exists();
      await waitFor(
        '[data-test-deposit-transaction-setup-is-complete] [data-test-boxel-action-chin] [data-test-boxel-button]'
      );
      await click(
        '[data-test-deposit-transaction-setup-is-complete] [data-test-boxel-action-chin] [data-test-boxel-button]'
      );
      await visit('/card-pay/token-suppliers?flow=deposit&flow-id=abc123');
      assert.dom('[data-test-milestone="0"]').exists(); // L1
      assert.dom('[data-test-milestone="1"]').exists(); // L2
      assert.dom('[data-test-deposit-transaction-setup-container]').exists();
      assert.dom('[data-test-transaction-amount-container]').doesNotExist();
    });

    test('it cancels a persisted flow when Layer 1 wallet address is different', async function (this: Context, assert) {
      const state = buildState({
        meta: {
          completedCardNames: [
            'LAYER1_CONNECT',
            'LAYER2_CONNECT',
            'TXN_SETUP',
            'TXN_AMOUNT',
          ],
        },
        depositSourceToken: 'DAI',
        depositedAmount: new BN('10000000000000000000'),
        layer1WalletAddress: '0xaaaaaaaaaaaaaaa', // Differs from layer1WalletAddress set in beforeEach
      });
      workflowPersistenceService.persistData('abc123', {
        name: 'RESERVE_POOL_DEPOSIT',
        state,
      });
      await visit('/card-pay/token-suppliers?flow=deposit&flow-id=abc123');
      assert.dom('[data-test-milestone="0"]').doesNotExist(); // L1
      assert.dom('[data-test-milestone="1"]').doesNotExist(); // L2
      assert.dom('[data-test-milestone="2"]').doesNotExist(); // Deposit
      assert
        .dom('[data-test-cancelation]')
        .includesText(
          'You attempted to restore an unfinished workflow, but you changed your Layer 1 wallet address. Please restart the workflow.'
        );
    });

    test('it cancels a persisted flow when card wallet address is different', async function (this: Context, assert) {
      const state = buildState({
        meta: {
          completedCardNames: [
            'LAYER1_CONNECT',
            'LAYER2_CONNECT',
            'TXN_SETUP',
            'TXN_AMOUNT',
          ],
        },
        depositSourceToken: 'DAI',
        depositedAmount: new BN('10000000000000000000'),
        layer2WalletAddress: '0xaaaaaaaaaaaaaaa', // Differs from layer2WalletAddress set in beforeEach
      });
      workflowPersistenceService.persistData('abc123', {
        name: 'RESERVE_POOL_DEPOSIT',
        state,
      });
      await visit('/card-pay/token-suppliers?flow=deposit&flow-id=abc123');
      assert.dom('[data-test-milestone="0"]').doesNotExist(); // L1
      assert.dom('[data-test-milestone="1"]').doesNotExist(); // L2
      assert.dom('[data-test-milestone="2"]').doesNotExist(); // Deposit
      assert
        .dom('[data-test-cancelation]')
        .includesText(
          'You attempted to restore an unfinished workflow, but you changed your Card wallet address. Please restart the workflow.'
        );
    });

    test('it allows interactivity after restoring previously saved state', async function (this: Context, assert) {
      const state = buildState({
        meta: {
          completedCardNames: ['LAYER1_CONNECT', 'LAYER2_CONNECT', 'TXN_SETUP'],
        },
        depositSourceToken: 'DAI',
        depositedAmount: new BN('10000000000000000000'),
      });
      workflowPersistenceService.persistData('abc123', {
        name: 'RESERVE_POOL_DEPOSIT',
        state,
      });
      await visit('/card-pay/token-suppliers?flow=deposit&flow-id=abc123');
      assert.dom('[data-test-milestone="0"]').exists(); // L1
      assert.dom('[data-test-milestone="1"]').exists(); // L2
      assert.dom('[data-test-deposit-transaction-setup-container]').exists();
      assert.dom('[data-test-transaction-amount-container]').exists();
      await click(
        '[data-test-transaction-amount-container] [data-test-unlock-button]'
      );
      assert
        .dom(
          '[data-test-transaction-amount-container] [data-test-unlock-button]'
        )
        .hasText('Unlocking');
      let layer1Service = this.owner.lookup('service:layer1-network')
        .strategy as Layer1TestWeb3Strategy;
      layer1Service.test__simulateUnlockTxnHash();
      await settled();

      assert
        .dom(
          `[data-test-transaction-amount-container] [data-test-unlock-etherscan-button]`
        )
        .exists();

      layer1Service.test__simulateUnlock();
      await settled();
    });
  });
});
