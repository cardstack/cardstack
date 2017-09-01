import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('cardstack/message-card', 'Integration | Component | message-card', {
  integration: true
});

test('it renders with the default implementation', function(assert) {
  this.render(hbs`{{cardstack/message-card}}`);
  assert.equal(this.$().text().trim(), '');
});
