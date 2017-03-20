import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('cs-collapsible-section', 'Integration | Component | cs collapsible section', {
  integration: true
});

test('it renders closed', function(assert) {
  this.render(hbs`
    {{#cs-collapsible-section opened=false title="My section"}}
      <div class="sample"></div>
    {{/cs-collapsible-section}}
  `);

  assert.equal(this.$('header').text().trim(), 'My section');
  assert.equal(this.$('.sample').length, 0, "doesn't render body when closed");
});

test('it renders open', function(assert) {
  // Template block usage:
  this.render(hbs`
    {{#cs-collapsible-section opened=true title="My section"}}
      <div class="sample"></div>
    {{/cs-collapsible-section}}
  `);

  assert.equal(this.$('.sample').length, 1, "found body");
});
