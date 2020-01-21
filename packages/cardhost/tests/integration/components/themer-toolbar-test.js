import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | themer-toolbar', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    this.set('model', {});
    await render(hbs`<ThemerToolbar @model={{this.model}}/>`);
    assert.dom(this.element).hasTextContaining('Close');
  });
});
