import { module, test } from 'qunit';
import { find, visit, currentURL, waitFor, settled, click } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures';
import { createCards } from '@cardstack/test-support/card-ui-helpers';
import { setupMockUser, login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';

const timeout = 20000;
const card1Id = 'millenial-puppies';
const qualifiedCard1Id = `local-hub::${card1Id}`;
const card2Id = 'van-gogh';
const qualifiedCard2Id = `local-hub::${card2Id}`;
const card3Id = 'hassan';
const qualifiedCard3Id = `local-hub::${card3Id}`;

const scenario = new Fixtures({
  create(factory) {
    setupMockUser(factory);
  },
  destroy() {
    return [
      { type: 'cards', id: qualifiedCard1Id },
      { type: 'cards', id: qualifiedCard2Id },
      { type: 'cards', id: qualifiedCard3Id },
    ];
  },
});

module('Acceptance | card view', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);
  hooks.beforeEach(function() {
    this.owner.lookup('service:data')._clearCache();
  });

  test(`viewing a card`, async function(assert) {
    await login();
    await createCards({
      [card3Id]: [
        ['name', 'string', true, 'Hassan Abdel-Rahman'],
        ['email', 'case-insensitive string', false, 'hassan@nowhere.dog'],
      ],
      [card2Id]: [
        ['name', 'string', true, 'Van Gogh'],
        ['email', 'string', false, 'vangogh@nowhere.dog'],
      ],
      [card1Id]: [
        ['title', 'string', true, 'The Millenial Puppy'],
        ['author', 'related card', true, card2Id],
        [
          'body',
          'string',
          false,
          'It can be difficult these days to deal with the discerning tastes of the millenial puppy.',
        ],
        ['reviewers', 'related cards', true, `${card2Id},${card3Id}`],
        ['likes', 'integer', true, 100],
        ['published', 'boolean', false, true],
        ['created', 'date', true, '2019-10-08'],
      ],
    });
    await visit(`/cards/${card1Id}`);

    assert.equal(currentURL(), `/cards/${card1Id}`);
    assert.dom('[data-test-field="title"] [data-test-string-field-viewer-value]').hasText('The Millenial Puppy');
    assert
      .dom('[data-test-field="body"] [data-test-string-field-viewer-value]')
      .hasText(`It can be difficult these days to deal with the discerning tastes of the millenial puppy.`);
    assert
      .dom(
        `[data-test-field="author"] [data-test-embedded-card="${card2Id}"] [data-test-field="name"] [data-test-string-field-viewer-value]`
      )
      .hasText('Van Gogh');
    assert
      .dom(`[data-test-field="author"] [data-test-embedded-card="${card2Id}"] [data-test-field="email"]`)
      .doesNotExist();
    assert
      .dom(
        `[data-test-field="reviewers"] [data-test-embedded-card="${card2Id}"] [data-test-field="name"] [data-test-string-field-viewer-value]`
      )
      .hasText('Van Gogh');
    assert
      .dom(
        `[data-test-field="reviewers"] [data-test-embedded-card="${card3Id}"] [data-test-field="name"] [data-test-string-field-viewer-value]`
      )
      .hasText('Hassan Abdel-Rahman');
    assert
      .dom(`[data-test-field="reviewers"] [data-test-embedded-card="${card2Id}"] [data-test-field="email"]`)
      .doesNotExist();
    assert
      .dom(`[data-test-field="reviewers"] [data-test-embedded-card="${card3Id}"] [data-test-field="email"]`)
      .doesNotExist();
    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-field="reviewers"] [data-test-embedded-card]`)].map(i =>
        i.getAttribute('data-test-embedded-card')
      ),
      [card2Id, card3Id]
    );

    assert.dom('[data-test-right-edge]').exists();
    assert.dom('[data-test-internal-card-id]').doesNotExist();
    assert.dom('[data-test-right-edge] [data-test-adopted-card-name]').hasText('Base Card');
    assert.dom('[data-test-appearance-section] .ember-power-select-selected-item').hasText('Cardstack default');
    assert.dom('[data-test-card-custom-style-button]').exists();

    let cardJson = find('[data-test-code-block]').getAttribute('data-test-code-block');
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes.title, 'The Millenial Puppy');
    assert.equal(
      card.data.attributes.body,
      `It can be difficult these days to deal with the discerning tastes of the millenial puppy.`
    );
    assert.equal(card.data.attributes.likes, 100);
    assert.equal(card.data.attributes.published, true);
    assert.equal(card.data.attributes.created, '2019-10-08');
    assert.deepEqual(card.data.relationships.author.data, { type: 'cards', id: qualifiedCard2Id });
    assert.deepEqual(card.data.relationships.reviewers.data, [
      { type: 'cards', id: qualifiedCard2Id },
      { type: 'cards', id: qualifiedCard3Id },
    ]);

    await percySnapshot(assert);
  });

  test('can navigate to the base-card', async function(assert) {
    await login();

    await visit(`/cards/@cardstack%2Fbase-card`);
    await waitFor(`[data-test-card-view="@cardstack/base-card"]`, { timeout });
    assert.equal(currentURL(), `/cards/@cardstack%2Fbase-card`);

    assert.dom('[data-test-field]').doesNotExist(); // base-card currenty has no fields
    await percySnapshot(assert);
  });

  test('can view code editor', async function(assert) {
    await login();

    await visit(`/cards/@cardstack%2Fbase-card/themer`);
    assert.equal(currentURL(), `/cards/@cardstack%2Fbase-card/themer`);
    await waitFor(`[data-test-card-view="@cardstack/base-card"]`, { timeout });
    assert.dom('[data-test-code-block]').exists();
    await settled();
    await percySnapshot(assert);
  });

  test('can dock code editor to bottom', async function(assert) {
    await login();

    await visit(`/cards/@cardstack%2Fbase-card/themer`);
    assert.equal(currentURL(), `/cards/@cardstack%2Fbase-card/themer`);
    await waitFor(`[data-test-card-view="@cardstack/base-card"]`, { timeout });
    assert.dom('[data-test-code-block]').exists();
    await settled();
    assert.dom('.cardhost-card-theme-editor').hasAttribute('data-test-dock-location', 'right');
    await click('[data-test-dock-bottom]');
    assert.dom('.cardhost-card-theme-editor').hasAttribute('data-test-dock-location', 'bottom');
    await percySnapshot(assert);
  });

  test('check that card name is stable so we can use it for themer styling', async function(assert) {
    await login();
    await createCards({
      [card1Id]: [
        ['title', 'string', true, 'The Millenial Puppy'],
        ['author', 'string', true, 'Van Gogh'],
        [
          'body',
          'string',
          false,
          'It can be difficult these days to deal with the discerning tastes of the millenial puppy.',
        ],
      ],
    });
    await visit(`/cards/${card1Id}`);
    assert.dom('.millenial-puppies').exists();
  });
});
