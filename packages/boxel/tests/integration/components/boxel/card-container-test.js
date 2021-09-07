import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import click from '@ember/test-helpers/dom/click';
import a11yAudit from 'ember-a11y-testing/test-support/audit';

module('Integration | Component | CardContainer', function (hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function (assert) {
    await render(hbs`
      <Boxel::CardContainer>
        <div>Card</div>
      </Boxel::CardContainer>
    `);
    assert.dom('[data-test-boxel-card-container]').exists();
    assert.dom('[data-test-boxel-card-container]').hasText('Card');
    assert
      .dom('[data-test-boxel-card-container]')
      .doesNotHaveClass('boxel-card-container--boundaries');
    assert
      .dom('[data-test-boxel-card-container]')
      .doesNotHaveClass('boxel-card-container--selected');

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });

  test('it can render with boundaries', async function (assert) {
    await render(hbs`
      <Boxel::CardContainer @displayBoundaries={{true}}>
        <div>Card</div>
      </Boxel::CardContainer>
    `);

    assert.dom('[data-test-boxel-card-container]').exists();
    assert
      .dom('[data-test-boxel-card-container]')
      .hasClass('boxel-card-container--boundaries');

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });

  test('it can be selected', async function (assert) {
    this.selected = false;
    this.toggleSelect = () => this.set('selected', !this.selected);

    await render(hbs`
      <Boxel::CardContainer
        @displayBoundaries={{true}}
        @isSelected={{this.selected}}
      >
        <Boxel::Header
          @header="Card Header"
          @selectionHeader={{true}}
          @isSelected={{this.selected}}
          @selectAction={{this.toggleSelect}}
        />
        <div>Card</div>
      </Boxel::CardContainer>
    `);

    assert
      .dom('[data-test-boxel-card-container]')
      .doesNotHaveClass('boxel-card-container--selected');

    await click('[data-test-boxel-header-label-button]');
    assert
      .dom('[data-test-boxel-card-container]')
      .hasClass('boxel-card-container--selected');

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');

    await click('[data-test-boxel-header-label-button]');
    assert
      .dom('[data-test-boxel-card-container]')
      .doesNotHaveClass('boxel-card-container--selected');
  });
});
