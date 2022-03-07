import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

module('Integration | Component | CardPicker', function (hooks) {
  setupRenderingTest(hooks);

  const CARDS = [
    {
      id: 'pia-midina',
      type: 'participant',
      name: 'Pia Midina',
      description: 'Recording artist & lyricist',
    },
    {
      id: 'jenny-sparks',
      type: 'participant',
      name: 'Jenny Sparks',
      description: 'Background singer',
    },
    {
      id: 'francesco-midina',
      type: 'participant',
      name: 'Francesco Midina',
      description: 'Producer (Francesco Rocks)',
      disabled: true,
    },
    {
      id: 'joel-kaplan',
      type: 'participant',
      name: 'Joel Kaplan',
      description: 'Mastering engineer',
      disabled: true,
    },
    {
      type: 'participant',
      name: 'Mariah Solis',
      description: 'Mixing engineer',
    },
  ];

  hooks.beforeEach(async function (this) {
    this.setProperties({
      items: CARDS,
      selectedItem: null,
      chooseItem: (val: Record<string, unknown>) =>
        this.set('selectedItem', val),
    });

    await render(
      hbs`<Boxel::CardPicker
        @items={{this.items}}
        @chooseItem={{this.chooseItem}}
        @selectedItem={{this.selectedItem}}
      as |item|>
        <Boxel::CardContainer @displayBoundaries={{true}} data-test-boxel-cp-item={{item.id}}>
          <Boxel::Header @header={{item.type}} />
          <h3>{{item.name}}</h3>
          <p>{{item.description}}</p>
        </Boxel::CardContainer>
      </Boxel::CardPicker>`
    );
  });

  test('it can select a card', async function (assert) {
    const card = CARDS[0];
    const card1 = CARDS[1];

    assert.dom('[data-test-boxel-card-picker]').exists();
    assert.dom('[data-test-boxel-card-picker-selected-card]').doesNotExist();

    await click('[data-test-boxel-card-picker-dropdown] > [role="button"]');
    assert
      .dom('.ember-power-select-option[aria-selected="false"]')
      .exists({ count: 5 });
    assert
      .dom(`[data-test-boxel-cp-item="${card.id}"]`)
      .containsText(card.name);
    assert
      .dom(`[data-test-boxel-cp-item="${card.id}"]`)
      .containsText(card.description);

    await click(`[data-test-boxel-cp-item=${card.id}]`);
    assert.dom('.ember-power-select-options').doesNotExist();
    assert
      .dom(
        `[data-test-boxel-card-picker-selected-card] > [data-test-boxel-cp-item="${card.id}"] h3`
      )
      .hasText(card.name);

    await click('[data-test-boxel-card-picker-dropdown] > [role="button"]');
    assert.dom('[data-option-index="0"]').hasAttribute('aria-selected', 'true');
    assert
      .dom('.ember-power-select-option[aria-selected="false"]')
      .exists({ count: 4 });

    await click(`[data-test-boxel-cp-item=${card1.id}]`);
    assert.dom('.ember-power-select-options').doesNotExist();
    assert
      .dom('[data-test-boxel-card-picker-selected-card]')
      .exists({ count: 1 });
    assert
      .dom(
        `[data-test-boxel-card-picker-selected-card] > [data-test-boxel-cp-item="${card1.id}"] p`
      )
      .hasText(card1.description);

    await click('[data-test-boxel-card-picker-dropdown] > [role="button"]');
    assert
      .dom('[data-option-index="0"]')
      .hasAttribute('aria-selected', 'false');
    assert.dom('[data-option-index="1"]').hasAttribute('aria-selected', 'true');
  });

  test('it does not select disabled items', async function (assert) {
    await click('[data-test-boxel-card-picker-dropdown] > [role="button"]');
    assert
      .dom('.ember-power-select-option[aria-disabled="true"]')
      .exists({ count: 2 });
    assert.dom('[data-option-index="3"]').hasAttribute('aria-disabled', 'true');

    await click('[data-option-index="3"]');
    assert.dom('.ember-power-select-options').exists();
    assert.dom('[data-test-boxel-card-picker-selected-card]').doesNotExist();

    await click('[data-option-index="4"]');
    assert.dom('.ember-power-select-options').doesNotExist();
    assert
      .dom('[data-test-boxel-card-picker-selected-card] h3')
      .hasText('Mariah Solis');
  });
});
