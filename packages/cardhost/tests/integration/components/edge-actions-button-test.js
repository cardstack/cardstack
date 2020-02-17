import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | edge-actions-button', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    await render(hbs`<EdgeActionsButton />`);
    assert.dom('[data-test-edge-actions-btn]').exists();
    assert.dom('[data-test-edge-actions-btn] svg').exists();
  });
});
