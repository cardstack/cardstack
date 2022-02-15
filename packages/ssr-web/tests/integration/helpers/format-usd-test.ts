import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Helper | format-usd', function (hooks) {
  setupRenderingTest(hooks);

  test('It should return a string formatted as $<amountWithTwoDecimals> USD', async function (assert) {
    this.set('inputValue', 0);
    await render(hbs`{{format-usd this.inputValue}} `);
    assert.dom(this.element).hasText('$0.00 USD');
    this.set('inputValue', 5);
    assert.dom(this.element).hasText('$5.00 USD');
    this.set('inputValue', 5.1);
    assert.dom(this.element).hasText('$5.10 USD');
    this.set('inputValue', 5.15);
    assert.dom(this.element).hasText('$5.15 USD');
    this.set('inputValue', 5.157);
    assert.dom(this.element).hasText('$5.16 USD');
  });

  test('It preserves a minimum precision of 3 for an amount less than 1', async function (assert) {
    this.set('inputValue', 0.00516);

    await render(hbs`{{format-usd this.inputValue}} `);
    assert.dom(this.element).hasText('$0.00516 USD');
  });
});
