import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, settled, waitUntil } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import BN from 'bn.js';

import Layer2Network from '../../../app/services/layer2-network';
import { setupOnerror, resetOnerror } from '@ember/test-helpers';
import { defer } from 'rsvp';

module('Integration | Helper | token-to-usd', function (hooks) {
  setupRenderingTest(hooks);
  let layer2Service!: Layer2Network;
  let layer2Strategy!: Layer2TestWeb3Strategy;
  hooks.beforeEach(function () {
    layer2Service = this.owner.lookup('service:layer2-network');
    layer2Strategy = layer2Service.strategy as Layer2TestWeb3Strategy;

    // Simulate being connected on layer 2 -- prereq to converting to USD
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer2Strategy.test__simulateAccountsChanged([layer2AccountAddress]);
  });
  hooks.afterEach(function () {
    resetOnerror();
  });

  test('it returns 0.00 without fetching converters if the amount requested is 0', async function (assert) {
    this.set('inputValue', new BN(0));
    await render(
      hbs`
        <div class="dai">{{token-to-usd 'DAI' this.inputValue}}</div>
        <div class="card">{{token-to-usd 'CARD' this.inputValue}}</div>
      `
    );
    assert.dom('.dai').containsText('0.00');
    assert.dom('.card').containsText('0.00');
    assert.deepEqual(
      layer2Strategy.test__lastSymbolsToUpdate,
      [],
      'It should not fetch any converters'
    );
  });

  test('it does not fetch converters if the helper is not used', async function (assert) {
    await render(hbs`Look mom, no hands!`);
    assert.deepEqual(
      layer2Strategy.test__lastSymbolsToUpdate,
      [],
      'It should not fetch any converters'
    );
  });

  test('it fetches two converters when DAI and CARD are requested', async function (assert) {
    this.set('inputValue', new BN(100));
    await render(
      hbs`{{token-to-usd 'DAI' this.inputValue}} {{token-to-usd 'CARD' this.inputValue}}`
    );
    assert.deepEqual(
      layer2Strategy.test__lastSymbolsToUpdate,
      ['CARD', 'DAI'],
      'It should fetch two converters'
    );
  });

  test('it fetches only DAI when only DAI is requested', async function (assert) {
    this.set('inputValue', new BN(100));
    await render(hbs`{{token-to-usd 'DAI' this.inputValue}}`);
    assert.deepEqual(
      layer2Strategy.test__lastSymbolsToUpdate,
      ['DAI'],
      'It should fetch only DAI conversion'
    );
  });

  test('it fetches only CARD when only CARD is requested', async function (assert) {
    this.set('inputValue', new BN(100));
    await render(hbs`{{token-to-usd 'CARD' this.inputValue}}`);
    assert.deepEqual(
      layer2Strategy.test__lastSymbolsToUpdate,
      ['CARD'],
      'It should fetch only CARD conversion'
    );
  });

  test('it throws an error if a token other than DAI or CARD is requested', async function (assert) {
    setupOnerror(function (err: Error) {
      assert.equal(
        err.message,
        'Invalid symbol LGTM passed to {{token-to-usd}}'
      );
    });
    await render(hbs`{{token-to-usd 'LGTM' this.inputValue}}`);
  });

  test('it renders conversion result to 2 decimal places', async function (assert) {
    this.set('tokenSymbol', 'DAI');
    this.set('inputValue', new BN('123000000000000000000'));
    await render(hbs`{{token-to-usd this.tokenSymbol this.inputValue}}`);
    assert.dom(this.element).hasText('24.60');

    this.set('inputValue', new BN('223000000000000000000'));
    assert.dom(this.element).hasText('44.60');
  });

  test('it updates conversion result when exchange rate changes', async function (assert) {
    this.set('tokenSymbol', 'DAI');
    this.set('inputValue', new BN('123000000000000000000'));
    await render(hbs`{{token-to-usd this.tokenSymbol this.inputValue}}`);
    assert.dom(this.element).hasText('24.60'); // based on default exchange rate

    layer2Strategy.test__simulatedExchangeRate = 0.3;
    // allow time for TokenToUsd service interval to expire
    await waitUntil(() => this.element.textContent?.trim() !== '24.60');
    assert.dom(this.element).hasText('36.90');
  });

  test('it renders an empty string while the conversion function is not yet set', async function (assert) {
    layer2Strategy.test__updateUsdConvertersDeferred = defer<void>();

    this.set('tokenSymbol', 'DAI');
    this.set('inputValue', new BN('123000000000000000000'));
    await render(hbs`{{token-to-usd this.tokenSymbol this.inputValue}}`);
    assert.dom(this.element).hasText('');

    layer2Strategy.test__updateUsdConvertersDeferred.resolve();
    await settled();
    assert.dom(this.element).hasText('24.60');
  });
});
