import { module, skip } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { find } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | cardstack query editor', function(hooks) {
  setupRenderingTest(hooks);

  skip('it renders', function(assert) {

    // Set any properties with this.set('myProperty', 'value');
    // Handle any actions with this.on('myAction', function(val) { ... });

    this.render(hbs`{{cardstack-query-editor}}`);

    assert.dom('*').hasText('');

    // Template block usage:
    this.render(hbs`
      {{#cardstack-query-editor}}
        template block text
      {{/cardstack-query-editor}}
    `);

    assert.dom('*').hasText('template block text');
  });
});
