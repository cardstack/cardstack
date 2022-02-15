import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Helper | format-amount', function (hooks) {
  setupRenderingTest(hooks);

  test('It displays a value without floating point rounding error', async function (assert) {
    this.set('inputValue', 23.240000000000002);

    await render(hbs`{{format-amount this.inputValue}} `);
    assert.dom(this.element).hasText('23.24');
  });
});
