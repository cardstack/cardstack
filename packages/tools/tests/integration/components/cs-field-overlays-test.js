import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('cs-field-overlays', 'Integration | Component | cs field overlays', {
  integration: true
});

test('it renders', function(assert) {
  this.render(hbs`{{cs-field-overlays}}`);
  assert.equal(this.$().text().trim(), '');
});
