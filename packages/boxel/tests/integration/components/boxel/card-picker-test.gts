import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render } from '@ember/test-helpers';
import { tracked } from '@glimmer/tracking';
import BoxelCardPicker, { PickableCard } from '@cardstack/boxel/components/boxel/card-picker';
import BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';
import BoxelHeader from '@cardstack/boxel/components/boxel/header';

class TrackedSelectedItem {
  @tracked value: PickableCard | undefined;
}

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
  ] as PickableCard[];

  hooks.beforeEach(async function () {
    let items = CARDS;
    let selectedItem = new TrackedSelectedItem();
    let chooseItem = (val: PickableCard) => { selectedItem.value = val; };

    await render(
      <template>
        <BoxelCardPicker
          @items={{items}}
          @chooseItem={{chooseItem}}
          @selectedItem={{selectedItem.value}}
        as |item|>
          <BoxelCardContainer @displayBoundaries={{true}} data-test-boxel-cp-item={{item.id}}>
            <BoxelHeader @header={{item.type}} />
            <h3>{{item.name}}</h3>
            <p>{{item.description}}</p>
          </BoxelCardContainer>
        </BoxelCardPicker>
      </template>
    );
  });

  test('it can select a card', async function (assert) {
    const card = CARDS[0];
    const card1 = CARDS[1];

    assert.dom('[data-test-boxel-card-picker]').exists();
    assert.dom('[data-test-boxel-card-picker-selected-card]').doesNotExist();

    await click('[data-test-boxel-card-picker-dropdown]');
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

    await click('[data-test-boxel-card-picker-dropdown]');
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

    await click('[data-test-boxel-card-picker-dropdown]');
    assert
      .dom('[data-option-index="0"]')
      .hasAttribute('aria-selected', 'false');
    assert.dom('[data-option-index="1"]').hasAttribute('aria-selected', 'true');
  });

  test('it does not select disabled items', async function (assert) {
    await click('[data-test-boxel-card-picker-dropdown]');
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
