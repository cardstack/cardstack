import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('cardstack-tools-launcher', 'Integration | Component | cardstack tools launcher', {
  integration: true
});

test('it renders', function(assert) {

  // Set any properties with this.set('myProperty', 'value');
  // Handle any actions with this.on('myAction', function(val) { ... });

  this.render(hbs`{{cardstack-tools-launcher}}`);

  assert.equal(this.$().text().trim(), '');

  // Template block usage:
  this.render(hbs`
    {{#cardstack-tools-launcher}}
      template block text
    {{/cardstack-tools-launcher}}
  `);

  assert.equal(this.$().text().trim(), 'template block text');
});
