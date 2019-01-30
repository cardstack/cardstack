import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { clickTrigger, selectChoose, typeInSearch } from 'ember-power-select/test-support/helpers';
import hbs from 'htmlbars-inline-precompile';
import RSVP from 'rsvp';

function run(fn) {
  return RSVP.resolve().then(() => fn.apply(this, arguments));
}

module('Integration | Component | field editors/dropdown search editor', async function(hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(async function() {
    this.store = this.owner.lookup('service:store');
    let model = await run(() => {
      return this.store.find('driver', 'metalmario');
    });
    this.set('model', model);
  });

  test('can search by words (default)', async function(assert) {
    await render(hbs`{{field-editors/dropdown-search-editor content=model field="bestTrack"}}`);

    assert.dom('.ember-power-select-selected-item').hasText('Electrodrome');

    await clickTrigger();
    assert.dom('.ember-power-select-option').exists({ count: 1 });
    assert.dom('.ember-power-select-option').hasText('Type to search', 'user prompted to search');

    await typeInSearch('mar');
    assert.dom('.ember-power-select-option').exists({ count: 1 });
    assert.dom('.ember-power-select-option').hasText('No results found', 'no search results for partial word');

    await typeInSearch('mario');
    assert.dom('.ember-power-select-option').exists({ count: 2 }, 'dropdown is rendered with search results');

    await selectChoose('.best-track-selector', 'Mario Circuit');

    assert.dom('.ember-power-select-selected-item').hasText('Mario Circuit');
  });

  test('can search by prefix', async function(assert) {
    this.set('editorOptions', { matchBy: 'prefix' });
    await render(hbs`{{field-editors/dropdown-search-editor content=model field="bestTrack" editorOptions=editorOptions}}`);

    assert.dom('.ember-power-select-selected-item').hasText('Electrodrome');

    await clickTrigger();
    assert.dom('.ember-power-select-option').exists({ count: 1 });
    assert.dom('.ember-power-select-option').hasText('Type to search', 'user prompted to search');

    await typeInSearch('mar');
    assert.dom('.ember-power-select-option').exists({ count: 2 }, 'dropdown is rendered with search results');

    await selectChoose('.best-track-selector', 'Mario Circuit');

    assert.dom('.ember-power-select-selected-item').hasText('Mario Circuit');
  });

  test('can search by exact match', async function(assert) {
    this.set('editorOptions', { matchBy: 'exact' });
    await render(hbs`{{field-editors/dropdown-search-editor content=model field="bestTrack" editorOptions=editorOptions}}`);

    assert.dom('.ember-power-select-selected-item').hasText('Electrodrome');

    await clickTrigger();
    assert.dom('.ember-power-select-option').exists({ count: 1 });
    assert.dom('.ember-power-select-option').hasText('Type to search', 'user prompted to search');

    await typeInSearch('mar');
    assert.dom('.ember-power-select-option').exists({ count: 1 });
    assert.dom('.ember-power-select-option').hasText('No results found', 'no search results for partial word');

    await typeInSearch('mario');
    assert.dom('.ember-power-select-option').exists({ count: 1 });
    assert.dom('.ember-power-select-option').hasText('No results found', 'no search results for single word');

    await typeInSearch('Mario');
    assert.dom('.ember-power-select-option').exists({ count: 1 });
    assert.dom('.ember-power-select-option').hasText('No results found', 'no search results for single capitalized word');

    await typeInSearch('mario circuit');
    assert.dom('.ember-power-select-option').exists({ count: 1 });
    assert.dom('.ember-power-select-option').hasText('No results found', 'no results, exact match is case-sensitive');

    await typeInSearch('Mario Circuit');
    assert.dom('.ember-power-select-option').exists({ count: 1 }, 'dropdown is rendered with search results');
    assert.dom('.ember-power-select-option').hasText('Mario Circuit', 'one result, matches exactly');

    await selectChoose('.best-track-selector', 'Mario Circuit');

    assert.dom('.ember-power-select-selected-item').hasText('Mario Circuit');
  });

  test('can specify a different field to use for option', async function(assert) {
    this.set('editorOptions', { displayFieldName: 'name' });
    await render(hbs`{{field-editors/dropdown-search-editor content=model field="vehicle" editorOptions=editorOptions}}`);

    assert.dom('.ember-power-select-selected-item').hasText('Sport Bike');

    await clickTrigger();
    await typeInSearch('kart');
    assert.dom('.ember-power-select-option').exists({ count: 1 }, 'Dropdown is rendered');

    await selectChoose('.vehicle-selector', 'Standard Kart');

    assert.dom('.ember-power-select-selected-item').hasText('Standard Kart');
  });

  test('it can be disabled', async function(assert) {
    await render(hbs`{{field-editors/dropdown-search-editor content=model field="vehicle" disabled=true}}`);

    await clickTrigger();
    assert.dom('.ember-power-select-option').doesNotExist('Dropdown is disabled');
  });
});
