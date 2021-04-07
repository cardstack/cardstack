import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import click from '@ember/test-helpers/dom/click';

module('Integration | Component | LayoutContainer', function (hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function (assert) {
    await render(hbs`
      <Boxel::LayoutContainer>
        <div>Layout Card</div>
      </Boxel::LayoutContainer>
    `);
    assert.dom('[data-test-boxel-layout-container]').exists();
    assert.dom('[data-test-boxel-layout-container]').hasText('Layout Card');
    assert.dom('[data-test-boxel-layout-header]').doesNotExist();
    assert
      .dom('[data-test-boxel-layout-container]')
      .doesNotHaveClass('boxel-layout-container--boundaries');
    assert
      .dom('[data-test-boxel-layout-container]')
      .doesNotHaveClass('boxel-card-container--selected');
  });

  test('it can render with tools and header', async function (assert) {
    await render(hbs`
      <Boxel::LayoutContainer @displayTools={{true}}>
        <div data-test-layout-container-test-content>Layout Card</div>
      </Boxel::LayoutContainer>
    `);

    assert.dom('[data-test-boxel-layout-container]').exists();
    assert.dom('[data-test-boxel-layout-header]').exists();
    assert
      .dom(
        '[data-test-boxel-layout-header] [data-test-boxel-header-label-button]'
      )
      .hasText('Layout');
    assert
      .dom('[data-test-boxel-layout-header] [data-test-boxel-header-button]')
      .exists({ count: 3 });
    assert
      .dom('[data-test-layout-container-test-content]')
      .hasText('Layout Card');
    assert
      .dom('[data-test-boxel-layout-container]')
      .hasClass('boxel-layout-container--boundaries');
    assert
      .dom('[data-test-boxel-layout-container]')
      .doesNotHaveClass('boxel-card-container--selected');
  });

  test('it can be selected', async function (assert) {
    this.selected = false;
    this.toggleSelect = () => this.set('selected', !this.selected);

    await render(hbs`
      <Boxel::LayoutContainer
        @displayTools={{true}}
        @isSelected={{this.selected}}
        @selectAction={{this.toggleSelect}}
      >
        <div>Layout Card</div>
      </Boxel::LayoutContainer>
    `);

    assert.dom('[data-test-boxel-layout-header]').exists();
    assert
      .dom('[data-test-boxel-layout-header]')
      .doesNotHaveClass('boxel-header--selected');
    assert
      .dom('[data-test-boxel-layout-container]')
      .doesNotHaveClass('boxel-card-container--selected');

    await click('[data-test-boxel-header-label-button]');

    assert
      .dom('[data-test-boxel-layout-container]')
      .hasClass('boxel-card-container--selected');
    assert
      .dom('[data-test-boxel-layout-header]')
      .hasClass('boxel-header--selected');
  });
});
