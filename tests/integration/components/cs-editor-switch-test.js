import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('cs-editor-switch', 'Integration | Component | cs editor switch', {
  integration: true
});

test('it renders', function(assert) {
  this.render(hbs`{{cs-editor-switch}}`);
  assert.equal(this.$('label:contains(Editor)').length, 1, "found label");
});
