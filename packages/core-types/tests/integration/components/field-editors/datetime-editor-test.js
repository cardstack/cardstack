import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, triggerEvent } from '@ember/test-helpers';
import EmberObject from '@ember/object';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | field editors/datetime editor', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    this.set('model', {
      expiration: '2030-01-01T10:00:00'
    });
    await render(hbs`{{field-editors/datetime-editor content=model field="expiration"}}`);

    assert.dom('input[type=datetime-local]').hasValue('2030-01-01T10:00:00', 'datetime input has correct value');
    assert.dom('input').isNotDisabled();
  });

  test('it renders with invalid datetime', async function(assert) {
    this.set('model', {
      expiration: 'pizza'
    });
    await render(hbs`{{field-editors/datetime-editor content=model field="expiration"}}`);
    assert.dom('input[type=datetime-local]').hasNoValue('datetime input has no value');
    assert.dom('input').isNotDisabled();
  });

  test('it can be disabled', async function(assert) {
    this.set('model', {
      expiration: '2030-01-01T10:00:00'
    });
    await render(hbs`{{field-editors/datetime-editor content=model field="expiration" disabled=true}}`);
    assert.dom('input').isDisabled();
  });

  test('onchange is called when the field is left', async function(assert) {
    let changed;
    this.set('onchange', () => {
      changed = true;
    });
    this.set('model', EmberObject.create({ rating: 3 }));
    await render(hbs`
      {{field-editors/datetime-editor
        content=model
        field="rating"
        onchange=onchange
      }}`);
    await triggerEvent('input', 'blur');
    assert.ok(changed);
  });
});
