import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import a11yAudit from 'ember-a11y-testing/test-support/audit';

module('Integration | Component | Header', function (hooks) {
  setupRenderingTest(hooks);

  hooks.afterEach(async function (assert) {
    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });

  test('it renders', async function (assert) {
    await render(hbs`<Boxel::Header>Header</Boxel::Header>`);
    assert.dom('[data-test-boxel-header]').exists();
    assert.dom('[data-test-boxel-header-label]').doesNotExist();
    assert.dom('[data-test-boxel-header-content]').hasText('Header');
  });

  test('it can render with header arg', async function (assert) {
    await render(hbs`<Boxel::Header @header="Card Header" />`);
    assert.dom('[data-test-boxel-header]').exists();
    assert.dom('[data-test-boxel-header-label]').hasText('Card Header');
    assert.dom('[data-test-boxel-header-button-group]').doesNotExist();
  });

  test('it can render without background-color', async function (assert) {
    await render(hbs`
      <Boxel::Header
        @header="Card Header"
        @noBackground={{true}}
      />
    `);

    assert
      .dom('[data-test-boxel-header]')
      .hasClass('boxel-header--no-background');
    assert.dom('[data-test-boxel-header-label]').hasText('Card Header');
  });

  test('it can render default highlight styles', async function (assert) {
    await render(hbs`
      <Boxel::Header
        @header="Card Header"
        @isHighlighted={{this.isHighlighted}}
      />
    `);

    assert
      .dom('[data-test-boxel-header]')
      .hasClass('boxel-header--highlighted');
  });
});
