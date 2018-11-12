import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | field editors/datetime editor', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    this.set('model', {
      expiration: '2030-01-01T10:00:00',
    });
    await render(hbs`{{field-editors/datetime-editor content=model field="expiration" enabled=true}}`);

    assert.dom('input[type=datetime-local]').hasValue('2030-01-01T10:00:00', 'datetime input has correct value');
    assert.dom('input').isNotDisabled('datetime field is not disabled');
  });

  test('it renders with invalid datetime', async function(assert) {
    this.set('model', {
      expiration: 'pizza',
    });
    await render(hbs`{{field-editors/datetime-editor content=model field="expiration" enabled=true}}`);
    assert.dom('input[type=datetime-local]').hasNoValue('datetime input has no value');
    assert.dom('input').isNotDisabled('datetime field is not disabled');
  });

  test('it can be disabled', async function(assert) {
    this.set('model', {
      expiration: '2030-01-01T10:00:00',
    });
    await render(hbs`{{field-editors/datetime-editor content=model field="expiration" enabled=false}}`);
    assert.dom('input').isDisabled('datetime field is disabled');
  });
});
