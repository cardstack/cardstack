import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('cs-toggle-switch', 'Integration | Component | cs toggle switch', {
  integration: true
});

test('it renders', function(assert) {
  this.render(hbs`
    {{#cs-toggle-switch value=true}}
      <div class="positive"></div>
    {{else}}
      <div class="negative"></div>
    {{/cs-toggle-switch}}
  `);
  assert.equal(this.$(".positive").length, 1, 'renders positive');
});

test('it renders inverse', function(assert) {
  this.render(hbs`
    {{#cs-toggle-switch value=false}}
      <div class="positive"></div>
    {{else}}
      <div class="negative"></div>
    {{/cs-toggle-switch}}
  `);
  assert.equal(this.$(".negative").length, 1, 'renders inverse');
});
