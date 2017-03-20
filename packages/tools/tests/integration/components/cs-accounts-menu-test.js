import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('cs-accounts-menu', 'Integration | Component | cs accounts menu', {
  integration: true
});

test('it renders', function(assert) {
  this.render(hbs`{{cs-accounts-menu}}`);
  assert.equal(this.$('svg').length, 1, 'found icon');
});
