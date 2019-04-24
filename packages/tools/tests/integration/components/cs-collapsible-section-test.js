import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | cs collapsible section', function (hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function (assert) {
    // Template block usage:
    await render(hbs`
      {{#cs-collapsible-section title="My section"}}
        <div data-test-sample></div>
      {{/cs-collapsible-section}}
    `);

    assert.dom('[data-test-sample]').exists();
  });
});
