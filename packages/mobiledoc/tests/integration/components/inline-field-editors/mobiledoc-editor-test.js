import { moduleForComponent, skip } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('inline-field-editors/mobiledoc-editor', 'Integration | Component | inline field editors/mobiledoc editor', {
  integration: true
});

skip('it renders', function(assert) {

  // Set any properties with this.set('myProperty', 'value');
  // Handle any actions with this.on('myAction', function(val) { ... });

  this.render(hbs`{{inline-field-editors/mobiledoc-editor}}`);

  assert.equal(this.$().text().trim(), '');

  // Template block usage:
  this.render(hbs`
    {{#inline-field-editors/mobiledoc-editor}}
      template block text
    {{/inline-field-editors/mobiledoc-editor}}
  `);

  assert.equal(this.$().text().trim(), 'template block text');
});
