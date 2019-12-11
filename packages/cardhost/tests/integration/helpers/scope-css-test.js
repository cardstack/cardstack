import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

let scoped = `.my-card .a {}
.my-card .b {}`;

module('Integration | Helper | scope-css', function(hooks) {
  setupRenderingTest(hooks);

  // Replace this with your real tests.
  test('it renders', async function(assert) {
    await render(hbs`{{scope-css ".a {}
.b {}" "my-card"}}`);
    assert.equal(this.element.textContent.trim(), scoped);
  });
});
