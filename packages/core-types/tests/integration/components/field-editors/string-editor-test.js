import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('field-editors/string-editor', 'Integration | Component | field editors/string editor', {
  integration: true
});

test('it renders', function(assert) {

  // Set any properties with this.set('myProperty', 'value');
  // Handle any actions with this.on('myAction', function(val) { ... });

  this.render(hbs`{{field-editors/string-editor}}`);

  assert.equal(this.$().text().trim(), '');

  // Template block usage:
  this.render(hbs`
    {{#field-editors/string-editor}}
      template block text
    {{/field-editors/string-editor}}
  `);

  assert.equal(this.$().text().trim(), 'template block text');
});
