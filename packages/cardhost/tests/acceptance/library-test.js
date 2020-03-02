import { module, test } from 'qunit';
import { click, visit, currentURL, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures';
import { createCards, setCardName, saveCard } from '@cardstack/test-support/card-ui-helpers';
import { setupMockUser, login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';

const timeout = 2000;
const card1Id = 'millenial-puppies';
const qualifiedCard1Id = `local-hub::${card1Id}`;
const card2Id = 'fancy-kitten';
const qualifiedCard2Id = `local-hub::${card2Id}`;
const card3Id = 'venus-guppy';
const qualifiedCard3Id = `local-hub::${card3Id}`;
const cardData = {
  [card1Id]: [['title', 'string', true, 'The Millenial Puppy']],
  [card2Id]: [['title', 'string', true, 'The Fancy Kitten']],
  [card3Id]: [['title', 'string', true, 'Venus the Guppy']],
};

const scenario = new Fixtures({
  create(factory) {
    setupMockUser(factory);
  },
  destroy() {
    return [
      {
        type: 'cards',
        id: qualifiedCard1Id,
      },
      {
        type: 'cards',
        id: qualifiedCard2Id,
      },
      {
        type: 'cards',
        id: qualifiedCard3Id,
      },
    ];
  },
});

module('Acceptance | library', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);

  hooks.beforeEach(async function() {
    this.owner.lookup('service:data')._clearCache();
    this.owner.lookup('service:card-local-storage').clearIds();
    // Until we have searching capabilities, we'll just render the contents of the
    // local store. So the first step is to warm up the store.
    await login();
  });

  hooks.afterEach(function() {
    this.owner.lookup('service:card-local-storage').clearIds();
  });

  test(`viewing library`, async function(assert) {
    await visit(`/`);
    await createCards(cardData);
    assert.dom('[data-test-library-button]').exists();
    await click('[data-test-library-button]');
    assert.dom('[data-test-library]').exists();
    assert.dom(`[data-test-embedded-card=${card1Id}]`).exists();
    assert.dom(`[data-test-embedded-card=${card2Id}]`).exists();
    assert.dom(`[data-test-embedded-card=${card3Id}]`).exists();
    assert.dom('[data-test-library-recent-card-link]').exists({ count: 3 });
    assert.dom('[data-test-library-adopt-card-btn]').exists({ count: 6 });
    assert.dom('[data-test-library-common-card-link]').exists({ count: 3 });
    assert.dom('[data-test-library-new-blank-card-btn]').exists({ count: 1 });
    await percySnapshot(assert);

    await visit(`/cards/${card1Id}`);
    assert.dom('[data-test-library-button]').exists();
    await click('[data-test-library-button]');
    assert.dom('[data-test-library]').exists();
    assert.dom(`[data-test-embedded-card=${card1Id}]`).exists();
    assert.dom(`[data-test-embedded-card=${card2Id}]`).exists();
    assert.dom(`[data-test-embedded-card=${card3Id}]`).exists();
    assert.dom('[data-test-library-recent-card-link]').exists({ count: 3 });
    assert.dom('[data-test-library-adopt-card-btn]').exists({ count: 6 });
    assert.dom('[data-test-library-common-card-link]').exists({ count: 3 });
    assert.dom('[data-test-library-new-blank-card-btn]').exists({ count: 1 });

    await visit(`/cards/${card1Id}/edit/fields`);
    await click('[data-test-library-button]');
    assert.dom('[data-test-library]').exists();
    assert.dom(`[data-test-embedded-card=${card1Id}]`).exists();
    assert.dom(`[data-test-embedded-card=${card2Id}]`).exists();
    assert.dom(`[data-test-embedded-card=${card3Id}]`).exists();
    assert.dom('[data-test-library-recent-card-link]').exists({ count: 3 });
    assert.dom('[data-test-library-adopt-card-btn]').exists({ count: 6 });
    assert.dom('[data-test-library-common-card-link]').exists({ count: 3 });
    assert.dom('[data-test-library-new-blank-card-btn]').exists({ count: 1 });

    await visit(`/cards/${card1Id}/edit/fields/schema`);
    await click('[data-test-library-button]');
    assert.dom('[data-test-library]').exists();
    assert.dom(`[data-test-embedded-card=${card1Id}]`).exists();
    assert.dom(`[data-test-embedded-card=${card2Id}]`).exists();
    assert.dom(`[data-test-embedded-card=${card3Id}]`).exists();
    assert.dom('[data-test-library-recent-card-link]').exists({ count: 3 });
    assert.dom('[data-test-library-adopt-card-btn]').exists({ count: 6 });
    assert.dom('[data-test-library-common-card-link]').exists({ count: 3 });
    assert.dom('[data-test-library-new-blank-card-btn]').exists({ count: 1 });
  });

  test(`closing library panel`, async function(assert) {
    await visit(`/cards`);
    await click('[data-test-library-button]');
    assert.dom('[data-test-library]').exists();
    await click('[data-test-library-close-button]');
    assert.dom('[data-test-library]').doesNotExist();
  });

  test(`created card ids are in local storage`, async function(assert) {
    await createCards(cardData);
    await visit(`/cards`);
    assert.equal(currentURL(), '/cards');
    let ids = this.owner.lookup('service:card-local-storage').getRecentCardIds();
    assert.ok(ids.includes(qualifiedCard1Id));
    assert.ok(ids.includes(qualifiedCard2Id));
    assert.ok(ids.includes(qualifiedCard3Id));
  });

  test(`can use library to view cards`, async function(assert) {
    await createCards(cardData);
    await visit('/cards');
    assert.equal(currentURL(), '/cards');
    await click('[data-test-library-button]');
    assert.dom(`[data-test-embedded-card=${card2Id}]`).exists();
    await click(`[data-test-embedded-card=${card2Id}]`);
    assert.equal(currentURL(), `/cards/${card2Id}`);
    assert.dom(`[data-test-card-view=${card2Id}]`).containsText('The Fancy Kitten');

    await visit(`/cards/${card1Id}`);
    assert.equal(currentURL(), `/cards/${card1Id}`);
    assert.dom(`[data-test-card-view=${card1Id}]`).containsText('The Millenial Puppy');
    await click('[data-test-library-button]');
    assert.dom(`[data-test-embedded-card=${card3Id}]`).exists();
    await click(`[data-test-embedded-card=${card3Id}]`);
    assert.equal(currentURL(), `/cards/${card3Id}`);
    assert.dom(`[data-test-card-view=${card3Id}]`).doesNotContainText('The Millenial Puppy');
    assert.dom(`[data-test-card-view=${card3Id}]`).containsText('Venus the Guppy');
  });

  test(`displays new card in recent cards section`, async function(assert) {
    await visit('/cards');
    assert.equal(currentURL(), '/cards');

    await click('[data-test-library-button]');
    assert.dom('[data-test-library]').exists();
    assert.dom('[data-test-library-recent-card-link]').doesNotExist();

    await click('[data-test-library-new-blank-card-btn]');
    await setCardName(card3Id);
    assert.equal(currentURL(), `/cards/${card3Id}/edit/fields/schema`);
    await saveCard();

    await click('[data-test-library-button]');
    assert.dom('[data-test-library-recent-card-link]').exists({ count: 1 });
    assert.dom(`[data-test-embedded-card=${card3Id}]`).exists();
  });

  test(`displays new adopted card in recent cards section`, async function(assert) {
    await visit('/cards');
    assert.equal(currentURL(), '/cards');

    await click('[data-test-library-button]');
    assert.dom('[data-test-library]').exists();
    assert.dom('[data-test-library-recent-card-link]').doesNotExist();

    await click('[data-test-library-adopt-card-btn]');
    await setCardName(card2Id);
    await waitFor(`[data-test-isolated-card=${card2Id}]`, { timeout });
    assert.equal(currentURL(), `/cards/${card2Id}/edit/fields`);
    await saveCard();

    await click('[data-test-library-button]');
    assert.dom('[data-test-library-recent-card-link]').exists({ count: 1 });
    assert.dom(`[data-test-embedded-card=${card2Id}]`).exists();
  });
});
