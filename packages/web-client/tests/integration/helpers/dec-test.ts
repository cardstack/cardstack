import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Helper | dec', function (hooks) {
  setupRenderingTest(hooks);

  test('five by two', async function (assert) {
    this.set('val', 5);
    this.set('amount', 2);
    await render(hbs`{{dec this.val this.amount}}`);
    assert.strictEqual(this.element.textContent?.trim(), '3');
  });

  test('five by default (one)', async function (assert) {
    this.set('val', 5);
    await render(hbs`{{dec this.val}}`);
    assert.strictEqual(this.element.textContent?.trim(), '4');
  });

  test('five by eight', async function (assert) {
    this.set('val', 5);
    this.set('amount', 8);
    await render(hbs`{{dec this.val this.amount}}`);
    assert.strictEqual(this.element.textContent?.trim(), '-3');
  });
});
