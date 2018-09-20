import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { clickTrigger, selectChoose } from 'ember-power-select/test-support/helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | field editors/dropdown choices editor', async function(hooks) {
  setupRenderingTest(hooks);

  test('can select an option from the dropdown', async function(assert) {
    this.set('model', {});
    await render(hbs`{{field-editors/dropdown-choices-editor content=model field="feeling" enabled=true}}`);

    await clickTrigger();
    assert.dom('.ember-power-select-option').exists({ count: 4 }, 'Dropdown is rendered');

    await selectChoose('.feeling-selector', 'Happy');

    assert.dom('.ember-power-select-selected-item').hasText('Happy');
  });

  test('can specify a different field to use for option', async function(assert) {
    this.set('model', {});
    this.set('editorOptions', { displayFieldName: 'name' });
    await render(hbs`{{field-editors/dropdown-choices-editor content=model field="vehicle" editorOptions=editorOptions enabled=true}}`);

    await clickTrigger();
    assert.dom('.ember-power-select-option').exists({ count: 4 }, 'Dropdown is rendered');

    await selectChoose('.vehicle-selector', 'Honeycoupe');

    assert.dom('.ember-power-select-selected-item').hasText('Honeycoupe');
  });

  test('it can be disabled', async function(assert) {
    this.set('model', {});
    await render(hbs`{{field-editors/dropdown-choices-editor content=model field="feeling" enabled=false}}`);

    await clickTrigger();
    assert.dom('.ember-power-select-option').doesNotExist('Dropdown is disabled');
  });
});
