import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { toWei } from 'web3-utils';
import BN from 'bn.js';

module('Integration | Helper | format-wei-amount', function (hooks) {
  setupRenderingTest(hooks);

  for (let round of [true, false]) {
    test(`${
      round ? 'rounded' : 'not rounded'
    }: it should return values with at least 2 decimal places`, async function (assert) {
      this.set('inputValue', toWei(new BN('1')));
      this.set('round', round);

      await render(hbs`{{format-wei-amount this.inputValue this.round}}`);
      assert.dom(this.element).hasText('1.00');

      this.set('inputValue', toWei(new BN('11')).div(new BN('10')));
      assert.dom(this.element).hasText('1.10');
    });

    test(`${
      round ? 'rounded' : 'not rounded'
    }: it should return values with separators`, async function (assert) {
      this.set('inputValue', toWei(new BN('1000')));
      this.set('round', round);

      await render(hbs`{{format-wei-amount this.inputValue this.round}}`);
      assert.dom(this.element).hasText('1,000.00');
    });
  }

  test('not rounded: It should return a precise value up to 18 decimals', async function (assert) {
    this.set('inputValue', new BN('123456789123456789'));
    this.set('round', false);
    await render(hbs`{{format-wei-amount this.inputValue this.round}}`);
    assert.dom(this.element).hasText('0.123456789123456789');
  });

  test('rounded: It should return a value with 2 significant digits for small but significant numbers (> 0.0001)', async function (assert) {
    this.set('inputValue', new BN('123000000000000'));
    this.set('round', true);

    await render(hbs`{{format-wei-amount this.inputValue this.round}}`);
    assert.dom(this.element).hasText('0.00012');
  });
});
