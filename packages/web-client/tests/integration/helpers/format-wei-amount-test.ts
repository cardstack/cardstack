import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { toWei } from 'web3-utils';
import BN from 'bn.js';

module('Integration | Helper | format-wei-amount', function (hooks) {
  setupRenderingTest(hooks);

  test('It should by default return values with exactly 2 decimal places if they are > 1 or < -1', async function (assert) {
    this.set('inputValue', toWei(new BN('1')));
    this.set('round', false);
    await render(hbs`{{format-wei-amount this.inputValue this.round}}`);
    assert.dom(this.element).hasText('1.00');

    this.set('round', true);
    assert.dom(this.element).hasText('1.00');

    this.set('inputValue', toWei(new BN('11')).div(new BN('10')));
    assert.dom(this.element).hasText('1.10');

    this.set('inputValue', toWei(new BN('111')).div(new BN('100')));
    assert.dom(this.element).hasText('1.11');

    this.set('inputValue', toWei(new BN('-11')).div(new BN('10')));
    assert.dom(this.element).hasText('-1.10');

    this.set('inputValue', toWei(new BN('-111')).div(new BN('100')));
    assert.dom(this.element).hasText('-1.11');
  });

  test('It should return a precise value up to 18 decimals if round is false', async function (assert) {
    this.set('inputValue', new BN('123456789123456789'));
    this.set('round', false);
    await render(hbs`{{format-wei-amount this.inputValue this.round}}`);
    assert.dom(this.element).hasText('0.123456789123456789');
  });

  test('It should have a minDecimals of 2 if an invalid minDecimals is provided', async function (assert) {
    this.set('inputValue', toWei(new BN('1')));
    this.set('minDecimals', 'beep');
    await render(hbs`{{format-wei-amount this.inputValue this.minDecimals}}`);

    assert.dom(this.element).hasText('1.00');

    this.set('minDecimals', -30);
    assert.dom(this.element).hasText('1.00');
  });

  test('It should render separator commas if amount is 1000 or greater', async function (assert) {
    this.set('inputValue', toWei(new BN('1000')));
    await render(hbs`{{format-wei-amount this.inputValue}}`);
    assert.dom(this.element).hasText('1,000.00');
  });
});
