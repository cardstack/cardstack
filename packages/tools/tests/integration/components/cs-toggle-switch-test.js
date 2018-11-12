import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | cs toggle switch', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    await render(hbs`
      {{#cs-toggle-switch value=true}}
        <div class="positive"></div>
      {{else}}
        <div class="negative"></div>
      {{/cs-toggle-switch}}
    `);
    assert.equal(this.$('.positive').length, 1, 'renders positive');
  });

  test('it renders inverse', async function(assert) {
    await render(hbs`
      {{#cs-toggle-switch value=false}}
        <div class="positive"></div>
      {{else}}
        <div class="negative"></div>
      {{/cs-toggle-switch}}
    `);
    assert.equal(this.$('.negative').length, 1, 'renders inverse');
  });
});
