
import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('group-id', 'helper:workflow-group-id', {
  integration: true
});

// Replace this with your real tests.
test('it renders', function(assert) {
  this.set('priority', 'Elevated');
  this.set('tag', 'Home');

  this.render(hbs`{{workflow-group-id priority tag}}`);

  assert.equal(this.$().text().trim(), 'Elevated::Home');
});

