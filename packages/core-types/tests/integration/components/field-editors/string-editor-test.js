import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('field-editors/string-editor', 'Integration | Component | field editors/string editor', {
  integration: true
});

test('it renders', function(assert) {
  this.set('model', {
    title: 'hello'
  });
  this.render(hbs`{{field-editors/string-editor content=model field="title"}}`);
  assert.equal(this.$('input').val(), 'hello');
});
