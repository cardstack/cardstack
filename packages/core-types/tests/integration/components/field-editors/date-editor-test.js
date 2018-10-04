import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | field editors/date editor', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    this.set('model', {
      expiration: '2030-01-01'
    });
    await render(hbs`{{field-editors/date-editor content=model field="expiration" enabled=true}}`);
    assert.dom('input[type=date]').hasValue('2030-01-01', 'date input has correct value');
    assert.dom('input').isNotDisabled('date field is not disabled');
  });

  test('it renders with invalid date', async function(assert) {
    this.set('model', {
      expiration: 'pizza'
    });
    debugger;
    await render(hbs`{{field-editors/date-editor content=model field="expiration" enabled=true}}`);
    assert.dom('input[type=date]').hasNoValue('date input has no value');
    assert.dom('input').isNotDisabled('date field is not disabled');
  });

  test('it can be disabled', async function(assert) {
    this.set('model', {
      expiration: '2030-01-01'
    });
    await render(hbs`{{field-editors/date-editor content=model field="expiration" enabled=false}}`);
    assert.dom('input').isDisabled('date field is disabled');
  });
});
