import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Helper | format-usd', function (hooks) {
  setupRenderingTest(hooks);

  test('It should return a string with two digits after the decimal point', async function (assert) {
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

  test('It should have a symbol of $ prefixed by default unless false or another symbol is specified', async function (assert) {
    this.set('inputValue', 5);

    await render(hbs`{{format-usd this.inputValue}} `);
    assert.dom(this.element).hasText('$5.00 USD');

    this.set('symbol', false);
    await render(hbs`{{format-usd this.inputValue symbol=this.symbol}} `);
    assert.dom(this.element).hasText('5.00 USD');

    this.set('symbol', '#');
    assert.dom(this.element).hasText('#5.00 USD');
  });

  test('It should have a suffix of " USD" unless false or another suffix is specified', async function (assert) {
    this.set('inputValue', 5);

    await render(hbs`{{format-usd this.inputValue}} `);
    assert.dom(this.element).hasText('$5.00 USD');

    this.set('suffix', false);
    await render(hbs`{{format-usd this.inputValue suffix=this.suffix}} `);
    assert.dom(this.element).hasText('$5.00');

    this.set('suffix', ' bucks');
    assert.dom(this.element).hasText('$5.00 bucks');
  });
});
