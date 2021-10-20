import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
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

  test('it can render highlight styles', async function (assert) {
    await render(hbs`
      <Boxel::CardContainer
        @displayBoundaries={{true}}
        @isHighlighted={{true}}
      >
        <div>Card</div>
      </Boxel::CardContainer>
    `);

    assert
      .dom('[data-test-boxel-card-container]')
      .hasClass('boxel-card-container--highlighted');

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });
});
