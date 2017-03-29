import { moduleForComponent, skip } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('field-renderers/mobiledoc-renderer', 'Integration | Component | field renderers/mobiledoc renderer', {
  integration: true
});

skip('it renders', function(assert) {

  // Set any properties with this.set('myProperty', 'value');
  // Handle any actions with this.on('myAction', function(val) { ... });

  this.render(hbs`{{field-renderers/mobiledoc-renderer}}`);

  assert.equal(this.$().text().trim(), '');

  // Template block usage:
  this.render(hbs`
    {{#field-renderers/mobiledoc-renderer}}
      template block text
    {{/field-renderers/mobiledoc-renderer}}
  `);

  assert.equal(this.$().text().trim(), 'template block text');
});
