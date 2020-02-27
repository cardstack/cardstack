import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

let scoped = `.my-card--isolated .a {}
.my-card--isolated .b {}`;

module('Integration | Helper | scope-css', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    this.set('card', { canonicalURL: 'my-card' });
    await render(hbs`{{scope-css ".a {}
.b {}" card "isolated"}}`);
    assert.equal(this.element.textContent.trim(), scoped);
  });
});
