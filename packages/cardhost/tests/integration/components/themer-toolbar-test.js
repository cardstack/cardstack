import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | themer-toolbar', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    this.set('model', {});
    await render(hbs`<ThemerToolbar @model={{this.model}}/>`);
    assert.dom('[data-test-themer-toolbar]').exists();
    assert.dom('[data-test-preview-link-btn]').exists();
    assert.dom('[data-test-card-size-toggle]').exists();
    assert.dom('[data-test-small-btn]').hasClass('selected');
    assert.dom('[data-test-hide-editor-btn]').exists();
    assert.dom('[data-test-hide-editor-btn]').hasClass('eye-on');
    assert.dom('[data-test-dock-bottom]').exists();
    assert.dom('[data-test-dock-right]').exists();
    assert.dom('[data-test-mode-indicator-link="edit"]').exists();
    assert.dom('[data-test-mode-indicator]').containsText('themer mode');
    assert.dom('[data-test-card-save-btn]').exists();
    assert.dom('[data-test-edge-actions-btn]').exists();
  });
});
