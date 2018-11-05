import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click, fillIn } from '@ember/test-helpers';
import { clickTrigger, selectChoose } from 'ember-power-select/test-support/helpers';
import hbs from 'htmlbars-inline-precompile';

const modelStub = {
  watchRelationship: (field, fn) => {
    fn.call(this);
  }
};

module('Integration | Component | field editors/advanced search editor', async function(hooks) {
  setupRenderingTest(hooks);

  test('can create an advanced search query', async function(assert) {
    this.set('model', modelStub);
    await render(hbs`{{field-editors/advanced-search-editor content=model field="related-drivers"}}`);

    await click('.expand-search');
    await selectChoose('.join-operator', 'AND');
    await selectChoose('.field-dropdown', 'Card Type');


    assert.dom('.ember-power-select-selected-item').hasText('and');
  });

  test('it can be disabled', async function(assert) {
    this.set('model', {});
    await render(hbs`{{field-editors/advanced-search-editor content=model field="feeling" disabled=true}}`);

    await clickTrigger();
    assert.dom('.ember-power-select-option').doesNotExist('Dropdown is disabled');
  });
});
