import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('cardstack-tools', 'Integration | Component | cardstack tools', {
  integration: true
});

test('it renders', function(assert) {

  // Set any properties with this.set('myProperty', 'value');
  // Handle any actions with this.on('myAction', function(val) { ... });

  this.render(hbs`{{cardstack-tools}}`);

  assert.equal(this.$().text().trim(), '');

  // Template block usage:
  this.render(hbs`
    {{#cardstack-tools}}
      template block text
    {{/cardstack-tools}}
  `);

  assert.equal(this.$().text().trim(), 'template block text');
});
