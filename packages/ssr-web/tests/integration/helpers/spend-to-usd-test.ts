import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Helper | spend-to-usd', function (hooks) {
  setupRenderingTest(hooks);

  test('it can convert spend amount to usd', async function (assert) {
    this.set('amount', 123456);
    await render(hbs`{{spend-to-usd this.amount}}`);
    assert.equal(this.element.textContent?.trim(), '1234.56');
  });

  test('empty input', async function (assert) {
    this.set('amount', '');
    await render(hbs`{{spend-to-usd this.amount}}`);
    assert.equal(this.element.textContent?.trim(), '0');
  });

  test('input type does not match', async function (assert) {
    this.set('amount', 'random words');
    await render(hbs`{{spend-to-usd this.amount}}`);
    assert.equal(this.element.textContent?.trim(), '');
  });
});
