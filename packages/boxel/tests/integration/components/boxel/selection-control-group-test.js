import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import a11yAudit from 'ember-a11y-testing/test-support/audit';

const SELECTION_CONTROL_GROUP_DATA_ATTRIBUTE =
  'data-test-boxel-selection-control-group';
const SELECTION_CONTROL_GROUP_SELECTOR =
  '[data-test-boxel-selection-control-group]';
const SELECTION_CONTROL_GROUP_TOGGLE_SELECTOR =
  '[data-test-boxel-selection-control-group-toggle]';
const SELECTION_CONTROL_GROUP_DROPDOWN_SELECTOR =
  '[data-test-boxel-dropdown-button]';

module('Integration | Component | SelectionControlGroup', function (hooks) {
  setupRenderingTest(hooks);

  hooks.afterEach(async function (assert) {
    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });

  test('It can render a state where all items are selected', async function (assert) {
    let toggled = false;
    this.setProperties({
      selectedItemCount: 5,
      toggleSelectAll: () => {
        toggled = true;
      },
      isSelected: true,
    });
    await render(
      hbs`<Boxel::SelectionControlGroup
            @selectedItemCount={{this.selectedItemCount}}
            @toggleSelectAll={{fn this.toggleSelectAll}}
            @isSelected={{this.isSelected}}
            @menuComponent={{component 'boxel/menu' items=(array
                (menu-item "Delete" (noop))
                (menu-item "Duplicate" (noop))
              )}}
          />`
    );
    assert.dom(`[${SELECTION_CONTROL_GROUP_DATA_ATTRIBUTE}=selected]`).exists();
    assert.dom(SELECTION_CONTROL_GROUP_SELECTOR).includesText('5 selected');
    assert.dom(SELECTION_CONTROL_GROUP_DROPDOWN_SELECTOR).exists();

    await click(SELECTION_CONTROL_GROUP_TOGGLE_SELECTOR);

    assert.true(toggled);
  });

  test('It can render a state where not all, but some items are selected', async function (assert) {
    let toggled = false;
    this.setProperties({
      selectedItemCount: 4,
      toggleSelectAll: () => {
        toggled = true;
      },
      isSelected: false,
    });
    await render(
      hbs`<Boxel::SelectionControlGroup
            @selectedItemCount={{this.selectedItemCount}}
            @toggleSelectAll={{fn this.toggleSelectAll}}
            @isSelected={{this.isSelected}}
            @menuComponent={{component 'boxel/menu' items=(array
                (menu-item "Delete" (noop))
                (menu-item "Duplicate" (noop))
              )}}
          />`
    );
    assert.dom(`[${SELECTION_CONTROL_GROUP_DATA_ATTRIBUTE}=partial]`).exists();
    assert.dom(SELECTION_CONTROL_GROUP_SELECTOR).includesText('4 selected');
    assert.dom(SELECTION_CONTROL_GROUP_DROPDOWN_SELECTOR).exists();

    await click(SELECTION_CONTROL_GROUP_TOGGLE_SELECTOR);

    assert.true(toggled);
  });

  test('It can render a state where no items are selected', async function (assert) {
    let toggled = false;
    this.setProperties({
      selectedItemCount: 0,
      toggleSelectAll: () => {
        toggled = true;
      },
      isSelected: false,
    });
    await render(
      hbs`<Boxel::SelectionControlGroup
            @selectedItemCount={{this.selectedItemCount}}
            @toggleSelectAll={{fn this.toggleSelectAll}}
            @isSelected={{this.isSelected}}
            @menuComponent={{component 'boxel/menu' items=(array
                (menu-item "Delete" (noop))
                (menu-item "Duplicate" (noop))
              )}}
          />`
    );
    assert.dom(`[${SELECTION_CONTROL_GROUP_DATA_ATTRIBUTE}=none]`).exists();
    assert.dom(SELECTION_CONTROL_GROUP_SELECTOR).includesText('Select all');
    assert.dom(SELECTION_CONTROL_GROUP_DROPDOWN_SELECTOR).doesNotExist();

    await click(SELECTION_CONTROL_GROUP_TOGGLE_SELECTOR);

    assert.true(toggled);
  });

  test('It can render without having a menu component passed in', async function (assert) {
    let toggled = false;
    this.setProperties({
      selectedItemCount: 4,
      toggleSelectAll: () => {
        toggled = true;
      },
      isSelected: true,
    });
    await render(
      hbs`<Boxel::SelectionControlGroup
            @selectedItemCount={{this.selectedItemCount}}
            @toggleSelectAll={{fn this.toggleSelectAll}}
            @isSelected={{this.isSelected}}
          />`
    );
    assert.dom(`[${SELECTION_CONTROL_GROUP_DATA_ATTRIBUTE}=selected]`).exists();
    assert.dom(SELECTION_CONTROL_GROUP_SELECTOR).includesText('4 selected');
    assert.dom(SELECTION_CONTROL_GROUP_DROPDOWN_SELECTOR).doesNotExist();

    await click(SELECTION_CONTROL_GROUP_TOGGLE_SELECTOR);

    assert.true(toggled);
  });
});
