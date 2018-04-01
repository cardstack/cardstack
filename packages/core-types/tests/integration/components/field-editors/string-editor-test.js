import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | field editors/string editor', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    this.set('model', {
      title: 'hello'
    });
    await render(hbs`{{field-editors/string-editor content=model field="title" enabled=true}}`);
    assert.equal(this.$('input').val(), 'hello');
    assert.equal(this.$('input[disabled]').length, 0);
  });

  test('it can be disabled', async function(assert) {
    this.set('model', {
      title: 'hello'
    });
    await render(hbs`{{field-editors/string-editor content=model field="title" enabled=false}}`);
    assert.equal(this.$('input[disabled]').length, 1);
  });
});
