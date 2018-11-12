import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | cs collapsible section', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders closed', async function(assert) {
    await render(hbs`
      {{#cs-collapsible-section opened=false title="My section"}}
        <div class="sample"></div>
      {{/cs-collapsible-section}}
    `);

    assert.equal(
      this.$('header')
        .text()
        .trim(),
      'My section',
    );
    assert.equal(this.$('.sample').length, 0, "doesn't render body when closed");
  });

  test('it renders open', async function(assert) {
    // Template block usage:
    await render(hbs`
      {{#cs-collapsible-section opened=true title="My section"}}
        <div class="sample"></div>
      {{/cs-collapsible-section}}
    `);

    assert.equal(this.$('.sample').length, 1, 'found body');
  });
});
