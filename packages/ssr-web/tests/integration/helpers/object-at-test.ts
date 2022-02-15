import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Helper | object-at', function (hooks) {
  setupRenderingTest(hooks);

  const ARR = ['a', 'b', 'c', 'd', 'e'];

  test('first element', async function (assert) {
    this.set('arr', ARR);
    this.set('index', 0);
    await render(hbs`{{object-at this.arr this.index}}`);
    assert.equal(this.element.textContent?.trim(), 'a');
  });

  test('middle element', async function (assert) {
    this.set('arr', ARR);
    this.set('index', 2);
    await render(hbs`{{object-at this.arr this.index}}`);
    assert.equal(this.element.textContent?.trim(), 'c');
  });

  test('last element', async function (assert) {
    this.set('arr', ARR);
    this.set('index', 4);
    await render(hbs`{{object-at this.arr this.index}}`);
    assert.equal(this.element.textContent?.trim(), 'e');
  });

  test('out of range low', async function (assert) {
    this.set('arr', ARR);
    this.set('index', -1);
    await render(hbs`{{object-at this.arr this.index}}`);
    assert.equal(this.element.textContent?.trim(), '');
  });

  test('out of range high', async function (assert) {
    this.set('arr', ARR);
    this.set('index', 10);
    await render(hbs`{{object-at this.arr this.index}}`);
    assert.equal(this.element.textContent?.trim(), '');
  });

  test('five by default (one)', async function (assert) {
    this.set('val', 5);
    await render(hbs`{{dec this.val}}`);
    assert.equal(this.element.textContent?.trim(), '4');
  });

  test('five by eight', async function (assert) {
    this.set('val', 5);
    this.set('amount', 8);
    await render(hbs`{{dec this.val this.amount}}`);
    assert.equal(this.element.textContent?.trim(), '-3');
  });
});
