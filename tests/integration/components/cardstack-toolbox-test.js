import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('cardstack-toolbox', 'Integration | Component | cardstack toolbox', {
  integration: true
});

test('it renders', function(assert) {

  // Set any properties with this.set('myProperty', 'value');
  // Handle any actions with this.on('myAction', function(val) { ... });

  this.render(hbs`{{cardstack-toolbox}}`);

  assert.equal(this.$().text().trim(), '');

  // Template block usage:
  this.render(hbs`
    {{#cardstack-toolbox}}
      template block text
    {{/cardstack-toolbox}}
  `);

  assert.equal(this.$().text().trim(), 'template block text');
});
