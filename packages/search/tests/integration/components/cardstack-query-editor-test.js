import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('cardstack-query-editor', 'Integration | Component | cardstack query editor', {
  integration: true
});

test('it renders', function(assert) {

  // Set any properties with this.set('myProperty', 'value');
  // Handle any actions with this.on('myAction', function(val) { ... });

  this.render(hbs`{{cardstack-query-editor}}`);

  assert.equal(this.$().text().trim(), '');

  // Template block usage:
  this.render(hbs`
    {{#cardstack-query-editor}}
      template block text
    {{/cardstack-query-editor}}
  `);

  assert.equal(this.$().text().trim(), 'template block text');
});
