import { module, test } from 'qunit';
import { click, visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures';
import { createCards } from '@cardstack/test-support/card-ui-helpers';
import { setupMockUser, login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { animationsSettled } from 'ember-animated/test-support';

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

module('Acceptance | card preview', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);
  hooks.beforeEach(function() {
    this.owner.lookup('service:data')._clearCache();
    this.owner.lookup('service:card-local-storage').clearIds();
  });

  test(`previewing a card`, async function(assert) {
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

    await visit(`/cards/${card1Id}/edit/preview`);
    assert.equal(currentURL(), `/cards/${card1Id}/edit/preview`);
    await animationsSettled();

    // can render page contents
    assert.dom('[data-test-cardhost-cards]').hasClass('preview');
    assert.dom('[data-test-cardhost-top-edge]').exists();
    assert.dom('[data-test-right-edge]').doesNotExist();
    assert.dom('[data-test-cardhost-left-edge]').doesNotExist();
    assert.dom('[data-test-card-renderer-isolated]').hasClass('preview');
    assert.dom('[data-test-isolated-card-mode="view"]').exists();

    // can render card contents
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

    await percySnapshot(assert);
  });

  test('can navigate to the page that opened it or default to layout mode', async function(assert) {
    await login();
    await createCards({
      [card1Id]: [['title', 'string', true, 'The Millenial Puppy']],
    });

    // can return to layout mode
    await visit(`/cards/${card1Id}/edit/layout`);
    assert.equal(currentURL(), `/cards/${card1Id}/edit/layout`);
    assert.dom('[data-test-card-renderer-isolated]').hasClass('layout');
    assert.dom('[data-test-isolated-card-mode="layout"]').exists();
    await click('[data-test-preview-link-btn]');
    assert.equal(currentURL(), `/cards/${card1Id}/edit/preview`);
    assert.dom('[data-test-card-renderer-isolated]').hasClass('preview');
    assert.dom('[data-test-isolated-card-mode="view"]').exists();
    assert.dom('[data-test-mode-indicator-link="previous"]').exists();
    await click('[data-test-mode-indicator]');
    assert.equal(currentURL(), `/cards/${card1Id}/edit/layout`);
    assert.dom('[data-test-card-renderer-isolated]').hasClass('layout');
    assert.dom('[data-test-isolated-card-mode="layout"]').exists();

    // can return to themer mode
    await visit(`/cards/${card1Id}/edit/layout/themer`);
    assert.equal(currentURL(), `/cards/${card1Id}/edit/layout/themer`);
    assert.dom('[data-test-card-renderer-isolated]').hasClass('themer');
    await click('[data-test-preview-link-btn]');
    assert.equal(currentURL(), `/cards/${card1Id}/edit/preview`);
    assert.dom('[data-test-card-renderer-isolated]').hasClass('preview');
    assert.dom('[data-test-mode-indicator-link="previous"]').exists();
    await click('[data-test-mode-indicator]');
    assert.equal(currentURL(), `/cards/${card1Id}/edit/layout/themer`);
    assert.dom('[data-test-card-renderer-isolated]').hasClass('themer', 'can return to themer');

    // can default to layout mode
    await visit(`/cards/${card1Id}/edit/preview`);
    assert.dom('[data-test-mode-indicator-link="edit-layout"]').exists();
    await click('[data-test-mode-indicator]');
    assert.equal(currentURL(), `/cards/${card1Id}/edit/layout`);
    assert.dom('[data-test-card-renderer-isolated]').hasClass('layout');
    assert.dom('[data-test-isolated-card-mode="layout"]').exists();
  });
});
