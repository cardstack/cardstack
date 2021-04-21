import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import click from '@ember/test-helpers/dom/click';
import a11yAudit from 'ember-a11y-testing/test-support/audit';

module('Integration | Component | Header', function (hooks) {
  setupRenderingTest(hooks);

  hooks.afterEach(async function (assert) {
    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });

  test('it renders', async function (assert) {
    await render(hbs`<Boxel::Header @header="Card Header" />`);
    assert.dom('[data-test-boxel-header]').exists();
    assert.dom('[data-test-boxel-header-label]').hasText('Card Header');
    assert.dom('[data-test-boxel-header-label-button]').doesNotExist();
    assert.dom('[data-test-boxel-header-button-group]').doesNotExist();
  });

  test('it can render without background-color', async function (assert) {
    await render(hbs`
      <Boxel::Header
        @header="Card Header"
        @noBackground={{true}}
      />
    `);

    assert.dom('[data-test-boxel-header]').exists();
    assert.dom('[data-test-boxel-header-label]').hasText('Card Header');
    assert
      .dom('[data-test-boxel-header]')
      .hasClass('boxel-header--no-background');
  });

  test('it can render as a selectable header', async function (assert) {
    await render(hbs`
      <Boxel::Header
        @header="Card Header"
        @selectionHeader={{true}}
      />
    `);

    assert.dom('[data-test-boxel-header]').exists();
    assert.dom('[data-test-boxel-header-label-button]').hasText('Card Header');
    assert.dom('[data-test-boxel-header-label]').doesNotExist();
  });

  test('it can be selected', async function (assert) {
    this.selected = false;
    this.toggleSelect = () => this.set('selected', !this.selected);

    await render(hbs`
      <Boxel::Header
        @header="Card Header"
        @selectionHeader={{true}}
        @isSelected={{this.selected}}
        @selectAction={{this.toggleSelect}}
      />
    `);

    assert
      .dom('[data-test-boxel-header]')
      .doesNotHaveClass('boxel-header--selected');

    await click('[data-test-boxel-header-label-button]');
    assert.dom('[data-test-boxel-header]').hasClass('boxel-header--selected');

    await click('[data-test-boxel-header-label-button]');
    assert
      .dom('[data-test-boxel-header]')
      .doesNotHaveClass('boxel-header--selected');
  });

  test('it can render with header buttons', async function (assert) {
    await render(hbs`
      <Boxel::Header
        @header="Card Header"
        @editable={{true}}
        @hasContextMenu={{true}}
        @expandable={{true}}
      />
    `);

    assert.dom('[data-test-boxel-header]').exists();
    assert.dom('[data-test-boxel-header-button-group]').exists();
    assert.dom('[data-test-boxel-header-edit-button]').exists();
    assert.dom('[data-test-boxel-header-menu-button]').exists();
    assert.dom('[data-test-boxel-header-expand-button]').exists();
  });
});
