import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('cs-toolbox-modes', 'Integration | Component | cs toolbox modes', {
  integration: true
});

test('it renders', function(assert) {
  this.render(hbs`
    {{#cs-toolbox-modes as |mode|}}
      {{cs-toolbox-mode-button mode=mode}}
    {{/cs-toolbox-modes}}
  `);

  assert.equal(this.$('.cs-toolbox-mode-button').length, 2);
});
