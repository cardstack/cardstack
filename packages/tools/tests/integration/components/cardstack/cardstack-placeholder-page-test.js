import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('cardstack/cardstack-placeholder-page', 'Integration | Component | cardstack/cardstack placeholder page', {
  integration: true
});

test('it renders', function(assert) {
  this.render(hbs`{{cardstack/cardstack-placeholder-page}}`);
  assert.equal(this.$('h1').text().trim(), 'Not Found');
});
