import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('cs-admin-launcher', 'Integration | Component | cs admin launcher', {
  integration: true
});

test('it renders', function(assert) {
  this.render(hbs`{{cs-admin-launcher}}`);
  assert.equal(this.$('svg').length, 1, 'found icon');
});
