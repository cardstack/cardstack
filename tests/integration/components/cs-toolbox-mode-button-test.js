import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('cs-toolbox-mode-button', 'Integration | Component | cs toolbox mode button', {
  integration: true
});

test('it renders', function(assert) {

  // Set any properties with this.set('myProperty', 'value');
  // Handle any actions with this.on('myAction', function(val) { ... });

  this.render(hbs`{{cs-toolbox-mode-button}}`);

  assert.equal(this.$().text().trim(), '');

  // Template block usage:
  this.render(hbs`
    {{#cs-toolbox-mode-button}}
      template block text
    {{/cs-toolbox-mode-button}}
  `);

  assert.equal(this.$().text().trim(), 'template block text');
});
