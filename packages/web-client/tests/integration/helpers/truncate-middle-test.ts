import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Helper | truncate-middle', function (hooks) {
  setupRenderingTest(hooks);

  test('typical input', async function (assert) {
    this.set('inputValue', '0xA0BACA1Ce00A95DED1674b3cC27bd1C77b6EDF9b');
    await render(hbs`{{truncate-middle this.inputValue 6 4}}`);
    assert.equal(this.element.textContent?.trim(), '0xA0BA...DF9b');
  });

  test('empty input', async function (assert) {
    this.set('inputValue', '');
    await render(hbs`{{truncate-middle this.inputValue 6 4}}`);
    assert.equal(this.element.textContent?.trim(), '');
  });

  test('short input', async function (assert) {
    this.set('inputValue', 'ABCDEFGHI');
    await render(hbs`{{truncate-middle this.inputValue 6 4}}`);
    assert.equal(this.element.textContent?.trim(), 'ABCDEFGHI');
  });
});
