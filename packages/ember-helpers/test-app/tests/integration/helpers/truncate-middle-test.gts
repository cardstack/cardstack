import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import truncateMiddle from '@cardstack/ember-helpers/helpers/truncate-middle';

module('Integration | Helper | truncate-middle', function (hooks) {
  setupRenderingTest(hooks);

  test('typical input', async function (assert) {
    let inputValue = '0xA0BACA1Ce00A95DED1674b3cC27bd1C77b6EDF9b';
    await render(<template>{{truncateMiddle inputValue}}</template>);
    assert.strictEqual(this.element.textContent?.trim(), '0xA0BA...DF9b');
  });

  test('empty input', async function (assert) {
    const inputValue = '';
    await render(<template>{{truncateMiddle inputValue}}</template>);
    assert.strictEqual(this.element.textContent?.trim(), '');
  });

  test('short input', async function (assert) {
    const inputValue = 'ABCDEFGHI';
    await render(<template>{{truncateMiddle inputValue}}</template>);
    assert.strictEqual(this.element.textContent?.trim(), 'ABCDEFGHI');
  });

  test('custom length', async function (assert) {
    const inputValue = '0xA0BACA1Ce00A95DED1674b3cC27bd1C77b6EDF9b';
    await render(<template>{{truncateMiddle inputValue 9 7}}</template>);
    assert.strictEqual(this.element.textContent?.trim(), '0xA0BACA1...b6EDF9b');
  });
});
