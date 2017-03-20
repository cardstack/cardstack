import { moduleForComponent, skip } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('cs-composition-panel', 'Integration | Component | cs composition panel', {
  integration: true
});

skip('it renders', function(assert) {

  // Set any properties with this.set('myProperty', 'value');
  // Handle any actions with this.on('myAction', function(val) { ... });

  this.render(hbs`{{cs-composition-panel}}`);

  assert.equal(this.$().text().trim(), '');

  // Template block usage:
  this.render(hbs`
    {{#cs-composition-panel}}
      template block text
    {{/cs-composition-panel}}
  `);

  assert.equal(this.$().text().trim(), 'template block text');
});
