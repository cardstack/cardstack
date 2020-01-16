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

module('Acceptance | catalog', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);

  hooks.beforeEach(async function() {
    this.owner.lookup('service:data')._clearCache();
    this.owner.lookup('service:card-local-storage').clearIds();
    // Until we have searching capabilities, we'll just render the contents of the
    // local store. So the first step is to warm up the store.
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
      [card1Id]: [['title', 'string', true, 'The Millenial Puppy']],
    });
  });

  hooks.afterEach(function() {
    this.owner.lookup('service:card-local-storage').clearIds();
  });

  test(`viewing catalog`, async function(assert) {
    await visit(`/`);
    assert.dom(`[data-test-embedded-card=${card1Id}]`).exists();
    assert.dom(`[data-test-embedded-card=${card2Id}]`).exists();
    assert.dom(`[data-test-embedded-card=${card3Id}]`).exists();
    await percySnapshot(assert);
  });

  test(`created card ids are in local storage`, async function(assert) {
    await visit(`/`);
    assert.equal(currentURL(), '/');
    let ids = this.owner.lookup('service:card-local-storage').getRecentCardIds();
    assert.ok(ids.includes(qualifiedCard1Id));
    assert.ok(ids.includes(qualifiedCard2Id));
    assert.ok(ids.includes(qualifiedCard3Id));
  });

  test(`isolating a card`, async function(assert) {
    await visit('/');
    assert.equal(currentURL(), '/');
    await animationsSettled();
    assert.dom(`[data-test-embedded-card=${card2Id}]`).exists();
    await click(`[data-test-embedded-card=${card2Id}]`);
    assert.equal(currentURL(), `/cards/${card2Id}`);
    await waitFor(`[data-test-card-view=${card2Id}]`, {
      timeout,
    });

    await percySnapshot(assert);
  });

  test('can navigate to catalog via left edge', async function(assert) {
    await visit(`/cards/${card1Id}`);
    assert.equal(currentURL(), `/cards/${card1Id}`);
    await waitFor(`[data-test-card-view=${card1Id}]`, {
      timeout,
    });
    await click('[data-test-library-link]');
    await waitFor(`[data-test-embedded-card=${card1Id}]`, {
      timeout,
    });
    assert.equal(currentURL(), '/');
  });
});
