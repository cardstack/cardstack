import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import click from '@ember/test-helpers/dom/click';

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
    assert
      .dom('[data-test-boxel-card-container]')
      .doesNotHaveClass('boxel-card-container--with-header');
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
  });

  test('it can render with header', async function (assert) {
    await render(hbs`
      <Boxel::CardContainer @hasHeader={{true}}>
        <Boxel::Header @header="Card Header" />
        <div>Card</div>
      </Boxel::CardContainer>
    `);

    assert
      .dom('[data-test-boxel-card-container] [data-test-boxel-header]')
      .exists();
    assert
      .dom('[data-test-boxel-card-container]')
      .hasClass('boxel-card-container--with-header');
  });

  test('it can be selected', async function (assert) {
    this.selected = false;
    this.toggleSelect = () => this.set('selected', !this.selected);

    await render(hbs`
      <Boxel::CardContainer
        @hasHeader={{true}}
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

    await click('[data-test-boxel-header-label-button]');
    assert
      .dom('[data-test-boxel-card-container]')
      .doesNotHaveClass('boxel-card-container--selected');
  });
});
