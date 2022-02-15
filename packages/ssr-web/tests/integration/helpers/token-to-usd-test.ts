import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, settled, waitUntil } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer1TestWeb3Strategy from '@cardstack/ssr-web/utils/web3-strategies/test-layer1';
import Layer2TestWeb3Strategy from '@cardstack/ssr-web/utils/web3-strategies/test-layer2';
import BN from 'bn.js';

import Layer1Network from '../../../app/services/layer1-network';
import Layer2Network from '../../../app/services/layer2-network';
import { setupOnerror, resetOnerror } from '@ember/test-helpers';
import { defer } from 'rsvp';
import { toWei } from 'web3-utils';

module('Integration | Helper | token-to-usd', function (hooks) {
  setupRenderingTest(hooks);
  let layer1Service!: Layer1Network;
  let layer1Strategy!: Layer1TestWeb3Strategy;
  let layer2Service!: Layer2Network;
  let layer2Strategy!: Layer2TestWeb3Strategy;
  hooks.beforeEach(function () {
    // Simulate being connected on layer 2 -- prereq to converting bridged tokens to USD
    layer2Service = this.owner.lookup('service:layer2-network');
    layer2Strategy = layer2Service.strategy as Layer2TestWeb3Strategy;
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer2Strategy.test__simulateAccountsChanged([layer2AccountAddress]);

    // Simulate being connected on layer 1 -- prereq to converting layer 1 tokens to USD
    layer1Service = this.owner.lookup('service:layer1-network');
    layer1Strategy = layer1Service.strategy as Layer1TestWeb3Strategy;
    let layer1AccountAddress = '0xa1b219c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer1Strategy.test__simulateAccountsChanged(
      [layer1AccountAddress],
      'metamask'
    );
  });
  hooks.afterEach(function () {
    resetOnerror();
  });

  test('it returns 0 without fetching converters if the amount requested is 0', async function (assert) {
    this.set('inputValue', new BN(0));
    await render(
      hbs`
      <div class="dai-cpxd">{{token-to-usd 'DAI.CPXD' this.inputValue}}</div>
      <div class="card-cpxd">{{token-to-usd 'CARD.CPXD' this.inputValue}}</div>
      <div class="dai">{{token-to-usd 'DAI' this.inputValue}}</div>
      <div class="card">{{token-to-usd 'CARD' this.inputValue}}</div>
      <div class="eth">{{token-to-usd 'ETH' this.inputValue}}</div>
      `
    );
    assert.dom('.dai-cpxd').containsText('0');
    assert.dom('.card-cpxd').containsText('0');
    assert.dom('.dai').containsText('0');
    assert.dom('.card').containsText('0');
    assert.dom('.eth').containsText('0');
    assert.deepEqual(
      layer1Strategy.test__lastSymbolsToUpdate,
      [],
      'It should not fetch any layer 1 converters'
    );
    assert.deepEqual(
      layer2Strategy.test__lastSymbolsToUpdate,
      [],
      'It should not fetch any layer 2 converters'
    );
  });

  test('it does not fetch converters if the helper is not used', async function (assert) {
    await render(hbs`Look mom, no hands!`);
    assert.deepEqual(
      layer1Strategy.test__lastSymbolsToUpdate,
      [],
      'It should not fetch any layer 1 converters'
    );
    assert.deepEqual(
      layer2Strategy.test__lastSymbolsToUpdate,
      [],
      'It should not fetch any layer 2 converters'
    );
  });

  test('it fetches two converters when DAI.CPXD and CARD.CPXD are requested', async function (assert) {
    this.set('inputValue', new BN(100));
    await render(
      hbs`{{token-to-usd 'DAI.CPXD' this.inputValue}} {{token-to-usd 'CARD.CPXD' this.inputValue}}`
    );
    assert.deepEqual(
      layer1Strategy.test__lastSymbolsToUpdate,
      [],
      'It should fetch no layer 1 converters'
    );
    assert.deepEqual(
      layer2Strategy.test__lastSymbolsToUpdate,
      ['CARD.CPXD', 'DAI.CPXD'],
      'It should fetch two layer 2 converters'
    );
  });

  test('it fetches two converters when DAI and CARD are requested', async function (assert) {
    this.set('inputValue', new BN(100));
    await render(
      hbs`{{token-to-usd 'DAI' this.inputValue}} {{token-to-usd 'CARD' this.inputValue}}`
    );
    assert.deepEqual(
      layer1Strategy.test__lastSymbolsToUpdate,
      [],
      'It should fetch no layer 1 converters'
    );
    assert.deepEqual(
      layer2Strategy.test__lastSymbolsToUpdate,
      ['CARD.CPXD', 'DAI.CPXD'],
      'It should fetch two layer 2 converters'
    );
  });

  test('it fetches one converter when ETH is requested', async function (assert) {
    this.set('inputValue', new BN(100));
    await render(hbs`{{token-to-usd 'ETH' this.inputValue}}`);
    assert.deepEqual(
      layer1Strategy.test__lastSymbolsToUpdate,
      ['ETH'],
      'It should fetch one layer 1 converter'
    );
    assert.deepEqual(
      layer2Strategy.test__lastSymbolsToUpdate,
      [],
      'It should fetch no layer 2 converters'
    );
  });

  test('it fetches only DAI.CPXD when only DAI.CPXD is requested', async function (assert) {
    this.set('inputValue', new BN(100));
    await render(hbs`{{token-to-usd 'DAI.CPXD' this.inputValue}}`);
    assert.deepEqual(
      layer1Strategy.test__lastSymbolsToUpdate,
      [],
      'It should fetch no layer 1 converters'
    );
    assert.deepEqual(
      layer2Strategy.test__lastSymbolsToUpdate,
      ['DAI.CPXD'],
      'It should fetch only layer 2 DAI.CPXD conversion'
    );
  });

  test('it fetches only CARD.CPXD when only CARD.CPXD is requested', async function (assert) {
    this.set('inputValue', new BN(100));
    await render(hbs`{{token-to-usd 'CARD.CPXD' this.inputValue}}`);
    assert.deepEqual(
      layer1Strategy.test__lastSymbolsToUpdate,
      [],
      'It should fetch no layer 1 converters'
    );
    assert.deepEqual(
      layer2Strategy.test__lastSymbolsToUpdate,
      ['CARD.CPXD'],
      'It should fetch only CARD conversion from layer 2'
    );
  });

  test('it fetches only DAI.CPXD and ETH when only DAI and ETH are requested', async function (assert) {
    this.set('inputValue', new BN(100));
    await render(
      hbs`{{token-to-usd 'DAI' this.inputValue}} {{token-to-usd 'ETH' this.inputValue}}`
    );
    assert.deepEqual(
      layer1Strategy.test__lastSymbolsToUpdate,
      ['ETH'],
      'It should fetch only ETH converter from layer 1'
    );
    assert.deepEqual(
      layer2Strategy.test__lastSymbolsToUpdate,
      ['DAI.CPXD'],
      'It should fetch only DAI conversion from layer 2'
    );
  });

  test('it throws an error if a token other than DAI, DAI.CPXD, CARD, CARD.CPXD, or ETH is requested', async function (assert) {
    setupOnerror(function (err: Error) {
      assert.equal(
        err.message,
        'Invalid symbol LGTM passed to {{token-to-usd}}'
      );
    });
    await render(hbs`{{token-to-usd 'LGTM' this.inputValue}}`);
  });

  test('it renders conversion result to 2 decimal places', async function (assert) {
    this.set('tokenSymbol', 'DAI.CPXD');
    this.set('inputValue', new BN('123000000000000000000'));
    await render(hbs`{{token-to-usd this.tokenSymbol this.inputValue}}`);
    assert.dom(this.element).hasText('24.6');

    this.set('inputValue', new BN('223000000000000000000'));
    assert.dom(this.element).hasText('44.6');
  });

  test('it updates conversion result when DAI exchange rate changes', async function (assert) {
    this.set('tokenSymbol', 'DAI.CPXD');
    this.set('inputValue', new BN('123000000000000000000'));
    await render(hbs`{{token-to-usd this.tokenSymbol this.inputValue}}`);
    assert.dom(this.element).hasText('24.6'); // based on default exchange rate

    layer2Strategy.test__simulatedExchangeRate = 0.3;
    // allow time for TokenToUsd service interval to expire
    await waitUntil(() => this.element.textContent?.trim() !== '24.6');
    assert.dom(this.element).hasText('36.9');
  });

  test('it updates conversion result when ETH exchange rate changes', async function (assert) {
    this.set('tokenSymbol', 'ETH');
    this.set('inputValue', new BN(toWei('2')));
    await render(hbs`{{token-to-usd this.tokenSymbol this.inputValue}}`);
    assert.dom(this.element).hasText('6000'); // based on default exchange rate

    layer1Strategy.test__simulatedExchangeRate = 3052.22;
    // allow time for TokenToUsd service interval to expire
    await waitUntil(() => this.element.textContent?.trim() !== '6000');
    assert.dom(this.element).hasText('6104.44');
  });

  test('it renders an empty string while the conversion function is not yet set', async function (assert) {
    layer2Strategy.test__updateUsdConvertersDeferred = defer<void>();

    this.set('tokenSymbol', 'DAI.CPXD');
    this.set('inputValue', new BN('123000000000000000000'));
    await render(hbs`{{token-to-usd this.tokenSymbol this.inputValue}}`);
    assert.dom(this.element).hasText('');

    layer2Strategy.test__updateUsdConvertersDeferred.resolve();
    await settled();
    assert.dom(this.element).hasText('24.6');
  });
});
