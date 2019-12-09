import { module, test } from 'qunit';
import { click, visit, currentURL, waitFor } from '@ember/test-helpers';
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
      [card1Id]: [
        ['title', 'string', true, 'The Millenial Puppy'],
        ['author', 'related card', true, card2Id],
        ['reviewers', 'related cards', true, `${card2Id},${card3Id}`],
      ],
    });
    await visit(`/cards/${card1Id}`);
  });

  test(`viewing catalog`, async function(assert) {
    await visit(`/`);

    assert.dom(`[data-test-embedded-card=${card1Id}]`).exists();
    assert.dom(`[data-test-embedded-card=${card2Id}]`).exists();
    assert.dom(`[data-test-embedded-card=${card3Id}]`).exists();
    await percySnapshot(assert);
  });

  test(`isolating a card`, async function(assert) {
    await visit(`/`);

    await click(`[data-test-embedded-card=${card3Id}]`);
    await waitFor(`[data-test-card-view=${card3Id}]`, {
      timeout,
    });

    assert.equal(currentURL(), `/cards/${card3Id}`);
    await percySnapshot(assert);
  });

  test('can navigate to catalog via left edge', async function(assert) {
    await visit(`/cards/${card1Id}`);
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
