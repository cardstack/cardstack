import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | themer-toolbar', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    this.set('closeEditor', () => {});
    await render(hbs`<ThemerToolbar @closeEditor={{this.closeEditor}} />`);
    assert.ok(this.element.textContent.includes('Close Editor'));
  });
});
