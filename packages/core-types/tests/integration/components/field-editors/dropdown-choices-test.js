import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { clickTrigger } from 'ember-power-select/test-support/helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | field editors/dropdown choices editor', async function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    this.set('model', {});
    await render(hbs`{{field-editors/dropdown-choices-editor content=model field="feeling" enabled=true}}`);

    await clickTrigger();
    assert.dom('.ember-power-select-option').exists({ count: 4 }, 'Dropdown is rendered');
  });

  test('it can be disabled', async function(assert) {
    this.set('model', {});
    await render(hbs`{{field-editors/dropdown-choices-editor content=model field="feeling" enabled=false}}`);

    await clickTrigger();
    assert.dom('.ember-power-select-option').doesNotExist('Dropdown is disabled');
  });
});
