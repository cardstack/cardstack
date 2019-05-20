import { module, skip } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | field renderers/mobiledoc renderer', function(hooks) {
  setupRenderingTest(hooks);

  skip('it renders', function(assert) {

    // Set any properties with this.set('myProperty', 'value');
    // Handle any actions with this.on('myAction', function(val) { ... });

    this.render(hbs`{{field-renderers/mobiledoc-renderer}}`);

    assert.dom('*').hasText('');

    // Template block usage:
    this.render(hbs`
      {{#field-renderers/mobiledoc-renderer}}
        template block text
      {{/field-renderers/mobiledoc-renderer}}
    `);

    assert.dom('*').hasText('template block text');
  });
});
