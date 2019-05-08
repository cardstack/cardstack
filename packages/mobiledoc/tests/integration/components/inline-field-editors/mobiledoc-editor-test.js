import { module, skip } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { find } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | inline field editors/mobiledoc editor', function(hooks) {
  setupRenderingTest(hooks);

  skip('it renders', function(assert) {

    // Set any properties with this.set('myProperty', 'value');
    // Handle any actions with this.on('myAction', function(val) { ... });

    this.render(hbs`{{inline-field-editors/mobiledoc-editor}}`);

    assert.dom('*').hasText('');

    // Template block usage:
    this.render(hbs`
      {{#inline-field-editors/mobiledoc-editor}}
        template block text
      {{/inline-field-editors/mobiledoc-editor}}
    `);

    assert.dom('*').hasText('template block text');
  });
});
