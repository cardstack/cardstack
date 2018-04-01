import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | cardstack session', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {

    await render(hbs`
      {{#cardstack-session as |session|}}
        template block text
      {{/cardstack-session}}
    `);

    assert.equal(this.$().text().trim(), 'template block text');
  });
});
