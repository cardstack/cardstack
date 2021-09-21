import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { toWei } from 'web3-utils';
import BN from 'bn.js';

module('Integration | Helper | format-token-amount', function (hooks) {
  setupRenderingTest(hooks);

  test('It should return a precise value up to 18 decimals', async function (assert) {
    this.set('inputValue', new BN('123456789123456789'));
    await render(hbs`{{format-token-amount this.inputValue}}`);
    assert.dom(this.element).hasText('0.123456789123456789');
  });

  test('It should add zeros to fulfil the required precision', async function (assert) {
    this.set('inputValue', toWei(new BN('1')));
    this.set('minDecimals', 1);
    await render(hbs`{{format-token-amount this.inputValue this.minDecimals}}`);
    assert.dom(this.element).hasText('1.0');

    this.set('minDecimals', 2);
    assert.dom(this.element).hasText('1.00');
  });

  test('It should respect existing non-zero floating decimals when adding zeros', async function (assert) {
    // 1.1
    this.set('inputValue', toWei(new BN('11')).div(new BN('10')));
    this.set('minDecimals', 3);
    await render(hbs`{{format-token-amount this.inputValue this.minDecimals}}`);
    assert.dom(this.element).hasText('1.100');

    // 1.11
    this.set('inputValue', toWei(new BN('111')).div(new BN('100')));
    assert.dom(this.element).hasText('1.110');
  });

  test('It should have a minDecimals of 2 by default', async function (assert) {
    this.set('inputValue', toWei(new BN('1')));
    await render(hbs`{{format-token-amount this.inputValue}}`);

    assert.dom(this.element).hasText('1.00');
  });

  test('It should have a minDecimals of 2 if an invalid minDecimals is provided', async function (assert) {
    this.set('inputValue', toWei(new BN('1')));
    this.set('minDecimals', 'beep');
    await render(hbs`{{format-token-amount this.inputValue this.minDecimals}}`);

    assert.dom(this.element).hasText('1.00');

    this.set('minDecimals', -30);
    assert.dom(this.element).hasText('1.00');
  });

  test('It should not add floating zeros if minDecimals is 0', async function (assert) {
    this.set('inputValue', toWei(new BN('1')));
    this.set('minDecimals', 0);
    await render(hbs`{{format-token-amount this.inputValue this.minDecimals}}`);
    assert.dom(this.element).hasText('1');
  });

  test('It should render separator commas if amount is 1000 or greater', async function (assert) {
    this.set('inputValue', toWei(new BN('1000')));
    await render(hbs`{{format-token-amount this.inputValue}}`);
    assert.dom(this.element).hasText('1,000.00');
  });
});
