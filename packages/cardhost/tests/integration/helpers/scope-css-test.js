import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Helper | scope-css', function(hooks) {
  setupRenderingTest(hooks);

  // Replace this with your real tests.
  test('it renders', async function(assert) {
    await render(hbs`{{scope-css ".some-class { font-size: 10px; }" "my-card"}}`);

    assert.equal(this.element.textContent.trim(), '.my-card .some-class { font-size: 10px; }');
  });
});
