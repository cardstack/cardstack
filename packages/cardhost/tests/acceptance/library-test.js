import { module, test } from 'qunit';
import { click, visit, currentURL, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures';
import { createCards } from '@cardstack/test-support/card-ui-helpers';
import { setupMockUser, login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { animationsSettled } from 'ember-animated/test-support';

const timeout = 2000;
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
    await createCards({
      [card1Id]: [['title', 'string', true, 'The Millenial Puppy']],
      [card2Id]: [['title', 'string', true, 'The Fancy Kitten']],
      [card3Id]: [['title', 'string', true, 'Venus the Guppy']],
    });
  });

  hooks.afterEach(function() {
    this.owner.lookup('service:card-local-storage').clearIds();
  });

  test(`viewing library from index page`, async function(assert) {
    await visit(`/`);
    assert.dom('[data-test-library-button]').exists();
    await click('[data-test-library-button]');
    assert.dom('[data-test-library]').exists();
    assert.dom(`[data-test-embedded-card=${card1Id}]`).exists();
    assert.dom(`[data-test-embedded-card=${card2Id}]`).exists();
    assert.dom(`[data-test-embedded-card=${card3Id}]`).exists();
    assert.dom('[data-test-library-recent-card-link]').exists();
    assert.dom('[data-test-library-adopt-card-btn]').exists();
    assert.dom('[data-test-library-common-card-link]').exists({ count: 3 });
    assert.dom('[data-test-library-new-blank-card-btn]').exists();
    await percySnapshot(assert);
  });

  test(`viewing library from a view page`, async function(assert) {
    await visit(`/cards/${card1Id}`);
    assert.dom('[data-test-library-button]').exists();
    await click('[data-test-library-button]');
    assert.dom('[data-test-library]').exists();
    assert.dom(`[data-test-embedded-card=${card1Id}]`).exists();
    assert.dom(`[data-test-embedded-card=${card2Id}]`).exists();
    assert.dom(`[data-test-embedded-card=${card3Id}]`).exists();
    assert.dom('[data-test-library-recent-card-link]').exists();
    assert.dom('[data-test-library-adopt-card-btn]').exists();
    assert.dom('[data-test-library-common-card-link]').exists({ count: 3 });
    assert.dom('[data-test-library-new-blank-card-btn]').exists();
    await percySnapshot(assert);
  });

  test(`closing library panel`, async function(assert) {
    await visit(`/cards`);
    await click('[data-test-library-button]');
    assert.dom('[data-test-library]').exists();
    await click('[data-test-library-close-button]');
    assert.dom('[data-test-library]').doesNotExist();
  });

  test(`created card ids are in local storage`, async function(assert) {
    await visit(`/cards`);
    assert.equal(currentURL(), '/cards');
    let ids = this.owner.lookup('service:card-local-storage').getRecentCardIds();
    assert.ok(ids.includes(qualifiedCard1Id));
    assert.ok(ids.includes(qualifiedCard2Id));
    assert.ok(ids.includes(qualifiedCard3Id));
  });

  test(`isolating a card`, async function(assert) {
    await visit('/cards');
    assert.equal(currentURL(), '/cards');
    await click('[data-test-library-button]');
    await animationsSettled();
    assert.dom(`[data-test-embedded-card=${card2Id}]`).exists();
    await click(`[data-test-embedded-card=${card2Id}]`);
    assert.equal(currentURL(), `/cards/${card2Id}`);
    await waitFor(`[data-test-card-view=${card2Id}]`, {
      timeout,
    });
    assert.dom(`[data-test-card-view=${card2Id}]`).containsText('The Fancy Kitten');
    await percySnapshot(assert);
  });

  test(`transitioning to a different card`, async function(assert) {
    await visit(`/cards/${card1Id}`);
    assert.equal(currentURL(), `/cards/${card1Id}`);
    assert.dom(`[data-test-card-view=${card1Id}]`).containsText('The Millenial Puppy');
    await click('[data-test-library-button]');
    await animationsSettled();
    assert.dom(`[data-test-embedded-card=${card3Id}]`).exists();
    await click(`[data-test-embedded-card=${card3Id}]`);
    assert.equal(currentURL(), `/cards/${card3Id}`);
    await waitFor(`[data-test-card-view=${card3Id}]`, {
      timeout,
    });
    assert.dom(`[data-test-card-view=${card3Id}]`).doesNotContainText('The Millenial Puppy');
    assert.dom(`[data-test-card-view=${card3Id}]`).containsText('Venus the Guppy');
  });
});
