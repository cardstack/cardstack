import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { clickTrigger, selectChoose, removeMultipleOption } from 'ember-power-select/test-support/helpers';
import hbs from 'htmlbars-inline-precompile';

const modelStub = {
  watchRelationship: (field, fn) => {
    fn.call(this);
  }
};

module('Integration | Component | field editors/dropdown multi select editor', async function(hooks) {
  setupRenderingTest(hooks);

  test('can select and remove option(s) from the dropdown', async function(assert) {
    this.set('model', modelStub);
    await render(hbs`{{field-editors/dropdown-multi-select-editor content=model field="tracks" editorOptions=editorOptions}}`);

    await clickTrigger();
    assert.dom('.ember-power-select-option').exists({ count: 4 }, 'Dropdown is rendered');

    await selectChoose('.tracks-selector', 'Twisted Mansion');
    await selectChoose('.tracks-selector', 'Rainbow Road');
    await selectChoose('.tracks-selector', 'Koopa City');

    assert.dom('.ember-power-select-multiple-option').exists({ count: 3 });
    assert.dom('.ember-power-select-multiple-option:nth-of-type(1)').hasText('× Twisted Mansion');
    assert.dom('.ember-power-select-multiple-option:nth-of-type(3)').hasText('× Koopa City');

    await removeMultipleOption('.tracks-selector', 'Rainbow Road');
    await removeMultipleOption('.tracks-selector', 'Koopa City');

    assert.dom('.ember-power-select-multiple-option').exists({ count: 1 });
    assert.dom('.ember-power-select-multiple-option').hasText('× Twisted Mansion');
  });

  test('can specify a different field to use for option', async function(assert) {
    this.set('model', modelStub);
    this.set('editorOptions', { displayFieldName: 'name' });
    await render(hbs`{{field-editors/dropdown-multi-select-editor content=model field="races" editorOptions=editorOptions}}`);

    await clickTrigger();
    assert.dom('.ember-power-select-option').exists({ count: 3 }, 'Dropdown is rendered');

    await selectChoose('.races-selector', 'Race 3');

    assert.dom('.ember-power-select-multiple-option').hasText('× Race 3');
  });

   test('it can be disabled', async function(assert) {
    this.set('model', {});
    this.set('editorOptions', { displayFieldName: 'name' });
    await render(hbs`{{field-editors/dropdown-multi-select-editor content=model field="races" disabled=true}}`);

    await clickTrigger();
    assert.dom('.ember-power-select-option').doesNotExist('Dropdown is disabled');
  });
});
