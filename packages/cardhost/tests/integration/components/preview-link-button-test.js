import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | preview-link-button', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    await render(hbs`<PreviewLinkButton />`);
    assert.dom('[data-test-preview-link-btn]').exists();
    assert.dom('[data-test-preview-link-btn]').hasText('Preview');
  });
});
