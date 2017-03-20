import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('cardstack-header', 'Integration | Component | cardstack header', {
  integration: true
});

test('it renders', function(assert) {
  this.render(hbs`{{cardstack-header}}`);
  assert.equal(this.$('label:contains(Editor)').length, 1, 'Found editor switch');
});
