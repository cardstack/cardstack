import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('field-editors/string-editor', 'Integration | Component | field editors/string editor', {
  integration: true
});

test('it renders', function(assert) {
  this.set('model', {
    title: 'hello'
  });
  this.render(hbs`{{field-editors/string-editor content=model field="title" enabled=true}}`);
  assert.equal(this.$('input').val(), 'hello');
  assert.equal(this.$('input[disabled]').length, 0);
});

test('it can be disabled', function(assert) {
  this.set('model', {
    title: 'hello'
  });
  this.render(hbs`{{field-editors/string-editor content=model field="title" enabled=false}}`);
  assert.equal(this.$('input[disabled]').length, 1);
});
