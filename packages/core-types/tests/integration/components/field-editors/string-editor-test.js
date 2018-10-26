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
    await render(hbs`{{field-editors/string-editor content=model field="title"}}`);
    assert.dom('input').hasValue('hello', 'text input has correct value');
    assert.dom('input').isNotDisabled('text input is not disabled');
  });

  test('it can be disabled', async function(assert) {
    this.set('model', {
      title: 'hello'
    });
    await render(hbs`{{field-editors/string-editor content=model field="title" disabled=true}}`);
    assert.dom('input[disabled]').isDisabled('text input is disabled');
  });
});
