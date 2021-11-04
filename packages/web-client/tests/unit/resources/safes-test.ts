import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import {
  Safes,
  SafesResourceStrategy,
  TrackedDepotSafe,
  TrackedMerchantSafe,
} from '@cardstack/web-client/resources/safes';
import { task, TaskGenerator } from 'ember-concurrency';
import { DepotSafe, Safe } from '@cardstack/cardpay-sdk';
import {
  createDepotSafe,
  createMerchantSafe,
  createPrepaidCardSafe,
  createSafeToken,
  generateMockAddress,
} from '@cardstack/web-client/utils/test-factories';
import { render, settled } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import BN from 'bn.js';
import { ViewSafesResult } from '@cardstack/cardpay-sdk/sdk/safes/base';
import { toWei } from 'web3-utils';
import { BridgedTokenSymbol } from '../../../app/utils/token';

const defaultBlockNumber = 5;
const address = generateMockAddress();
const createDefaultDepotSafe = (daiBalance?: string, infoDID?: string) =>
  createDepotSafe({
    address,
    tokens: daiBalance ? [createSafeToken('DAI.CPXD', daiBalance)] : [],
    infoDID,
  });

interface MockSafesResourceStrategy extends SafesResourceStrategy {
  _graphData: ViewSafesResult;
  _blockNumber: number;
  _latestSafe: Safe;
}

class PartialLayer2Strategy implements MockSafesResourceStrategy {
  _graphData: ViewSafesResult; // the next data to be fetched by viewSafesTask
  _blockNumber = defaultBlockNumber; // the next block number to be assigned to an individual update
  _latestSafe = createDefaultDepotSafe(); // the next safe fetched by an individual update
  issuePrepaidCardSpendMinValue = 1;
  issuePrepaidCardDaiMinValue = new BN(toWei('1'));

  constructor(initialData?: ViewSafesResult) {
    this._graphData = initialData ?? {
      safes: [],
      blockNumber: defaultBlockNumber,
    };
  }
  bridgedDaiTokenSymbol: BridgedTokenSymbol = 'DAI.CPXD';

  async getBlockHeight() {
    return new BN(this._blockNumber);
  }

  @task *viewSafesTask(): TaskGenerator<ViewSafesResult> {
    return yield JSON.parse(JSON.stringify(this._graphData));
  }

  async getLatestSafe(_address: string) {
    return JSON.parse(JSON.stringify(this._latestSafe));
  }
}

// these tests will stub data-fetching, which will not be tested.
// they will only test getting the latest safe based on data structure
module('Unit | Resource | Safes', function (hooks) {
  setupRenderingTest(hooks);

  let safes: Safes;
  let strategy: MockSafesResourceStrategy;
  let defaultDepotSafe: DepotSafe;

  hooks.beforeEach(async function () {
    defaultDepotSafe = createDefaultDepotSafe();
    strategy = new PartialLayer2Strategy({
      safes: [defaultDepotSafe],
      blockNumber: defaultBlockNumber,
    });
    safes = new Safes(this.owner, {
      named: {
        strategy,
        walletAddress: 'some-address',
      },
    });
    await settled();
  });

  test('it can return a TrackedSafe defined in graphData but not in individual update data', async function (assert) {
    assert.deepEqual(
      safes.getByAddress(defaultDepotSafe.address)!,
      new TrackedDepotSafe(defaultDepotSafe)
    );
  });

  test('it can return a TrackedSafe defined in individual update data but not in graphData', async function (assert) {
    let merchantSafe = createMerchantSafe({});
    strategy._latestSafe = merchantSafe;

    await safes.updateOne(merchantSafe.address);
    assert.deepEqual(
      safes.getByAddress(merchantSafe.address)!,
      new TrackedMerchantSafe(merchantSafe)
    );
  });

  test('it returns null when it fails to get a safe by address', async function (assert) {
    assert.equal(safes.getByAddress('not-an-address'), null);
  });

  test('it returns the individual safe state if the block number is greater than the graph block number', async function (assert) {
    strategy._latestSafe = createDefaultDepotSafe('30');
    strategy._blockNumber = defaultBlockNumber + 1;
    await safes.updateOne(defaultDepotSafe.address);

    await settled();

    assert.equal(safes.graphData.blockNumber, defaultBlockNumber);
    assert.equal(
      safes.individualSafeUpdateData[defaultDepotSafe.address]!.blockNumber,
      defaultBlockNumber + 1
    );
    assert.deepEqual(
      safes.getByAddress(defaultDepotSafe.address)!.tokens[0].balance,
      '30'
    );
  });

  test('it returns the graph safe state if the block number is greater than or equal to the individual safe state', async function (assert) {
    strategy._latestSafe = createDefaultDepotSafe('30');
    await safes.updateOne(defaultDepotSafe.address);

    await settled();

    assert.equal(safes.graphData.blockNumber, defaultBlockNumber);
    assert.equal(
      safes.individualSafeUpdateData[defaultDepotSafe.address]!.blockNumber,
      defaultBlockNumber
    );
    assert.equal(
      safes.getByAddress(defaultDepotSafe.address)!.tokens.length,
      0
    );

    strategy._graphData = {
      safes: [createDefaultDepotSafe()],
      blockNumber: defaultBlockNumber + 10,
    };
    await safes.fetch();

    assert.equal(safes.graphData.blockNumber, defaultBlockNumber + 10);
    assert.equal(
      safes.individualSafeUpdateData[defaultDepotSafe.address]!.blockNumber,
      defaultBlockNumber
    );
    assert.equal(
      safes.getByAddress(defaultDepotSafe.address)!.tokens.length,
      0
    );
  });

  test('updating all safes by fetching from the graph updates a rendered view that uses both nested or direct property', async function (assert) {
    this.setProperties({
      safes,
    });

    await render(
      hbs`
      {{#each this.safes.value as |safe|}}
        <div id="safe-did">
          {{#if safe.infoDID}}
            {{safe.infoDID}}
          {{else}}
            No DID found
          {{/if}}
        </div>
        {{#each safe.tokens as |token|}}
          <div data-test-token={{token.token.symbol}}>
            {{token.token.symbol}}: {{token.balance}}
          </div>
        {{/each}}
      {{/each}}
      `
    );

    assert.dom('#safe-did').containsText('No DID found');
    assert.dom('[data-test-token="DAI.CPXD"]').doesNotExist();

    strategy._graphData = {
      safes: [createDefaultDepotSafe('30', 'mock-infoDID')],
      blockNumber: defaultBlockNumber + 1,
    };
    await safes.fetch();

    await settled();

    assert.dom('#safe-did').containsText('mock-infoDID');
    assert.dom('[data-test-token="DAI.CPXD"]').containsText('DAI.CPXD: 30');
  });

  test('updating a safe using updateOne updates a rendered view that uses both nested or direct property', async function (assert) {
    this.setProperties({
      safes,
    });

    await render(
      hbs`
      {{#each this.safes.value as |safe|}}
        <div id="safe-did">
          {{#if safe.infoDID}}
            {{safe.infoDID}}
          {{else}}
            No DID found
          {{/if}}
        </div>
        {{#each safe.tokens as |token|}}
          <div data-test-token={{token.token.symbol}}>
            {{token.token.symbol}}: {{token.balance}}
          </div>
        {{/each}}
      {{/each}}
      `
    );

    assert.dom('#safe-did').containsText('No DID found');
    assert.dom('[data-test-token="DAI.CPXD"]').doesNotExist();

    strategy._blockNumber = defaultBlockNumber + 1;
    strategy._latestSafe = createDefaultDepotSafe('30', 'mock-infoDID');
    await safes.updateOne(defaultDepotSafe.address);

    await settled();

    assert.dom('#safe-did').containsText('mock-infoDID');
    assert.dom('[data-test-token="DAI.CPXD"]').containsText('DAI.CPXD: 30');
  });

  test('it aliases the first depot it finds to depot', async function (assert) {
    assert.deepEqual(safes.depot, new TrackedDepotSafe(defaultDepotSafe));
  });

  test('it can update the aliased depot via updateDepot', async function (assert) {
    assert.deepEqual(safes.depot, new TrackedDepotSafe(defaultDepotSafe));

    let updatedSafe = createDefaultDepotSafe('90');

    strategy._latestSafe = updatedSafe;
    strategy._blockNumber = defaultBlockNumber + 1;
    await safes.updateDepot();

    assert.deepEqual(safes.depot, new TrackedDepotSafe(updatedSafe));
  });

  test('it can clear graphData, individual update data, safe references, and value', async function (assert) {
    await safes.updateOne(defaultDepotSafe.address);

    assert.equal(safes.graphData.safes.length, 1);
    assert.equal(Object.keys(safes.individualSafeUpdateData).length, 1);
    assert.equal(Object.keys(safes.safeReferences).length, 1);
    assert.equal(safes.value.length, 1);

    safes.clear();

    assert.equal(safes.graphData.safes.length, 0);
    assert.equal(Object.keys(safes.individualSafeUpdateData).length, 0);
    assert.equal(Object.keys(safes.safeReferences).length, 0);
    assert.equal(safes.value.length, 0);
  });

  test('it returns safes that are compatible with and have sufficient balance for issuing a prepaid card', async function (assert) {
    defaultDepotSafe = createDefaultDepotSafe(toWei('100'));

    let sufficientTokens = [
      createSafeToken('DAI.CPXD', toWei('25')),
      createSafeToken('CARD.CPXD', toWei('25')),
    ];

    let insufficientTokens = [
      createSafeToken('DAI.CPXD', '1'),
      createSafeToken('CARD.CPXD', toWei('25')),
    ];

    let sufficientMerchantSafe = createMerchantSafe({
      tokens: sufficientTokens,
    });

    strategy = new PartialLayer2Strategy({
      safes: [
        defaultDepotSafe,
        sufficientMerchantSafe,
        createMerchantSafe({ tokens: insufficientTokens }),
        createPrepaidCardSafe({ tokens: sufficientTokens }),
      ],
      blockNumber: defaultBlockNumber,
    });

    safes = new Safes(this.owner, {
      named: {
        strategy,
        walletAddress: 'some-address',
      },
    });
    await settled();

    assert.deepEqual(
      safes.issuePrepaidCardSourceSafes.mapBy('address'),
      [defaultDepotSafe, sufficientMerchantSafe].mapBy('address')
    );
  });
});
