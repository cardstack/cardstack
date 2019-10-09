
import { module, test } from 'qunit';
import { click, visit, currentURL, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures'
import { createCards } from '../helpers/card-helpers';
import { setupMockUser, login } from '../helpers/login';

const timeout = 5000;
const card1Id = 'local-hub::article-card::millenial-puppies';
const card2Id = 'local-hub::user-card::van-gogh';
const card3Id = 'local-hub::user-card::hassan';

const scenario = new Fixtures({
  create(factory) {
    setupMockUser(factory);
  },
  destroy() {
    return [
      { type: 'cards', id: card1Id },
      { type: 'cards', id: card2Id },
      { type: 'cards', id: card3Id }
    ];
  }
});

module('Acceptance | catalog', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);

  hooks.beforeEach(async function () {
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
      ]
    });
    await visit(`/cards/${card1Id}`);
  });

  test(`viewing catalog`, async function(assert) {
    await visit(`/`);

    assert.dom(`.card-catalog > .card-renderer--embedded-card-link[href="/cards/${card1Id}"]`).exists();
    assert.dom(`.card-catalog > .card-renderer--embedded-card-link[href="/cards/${card2Id}"]`).exists();
    assert.dom(`.card-catalog > .card-renderer--embedded-card-link[href="/cards/${card3Id}"]`).exists();
  });

  test(`isolating a card`, async function(assert) {
    await visit(`/`);

    await click(`.card-catalog > .card-renderer--embedded-card-link[href="/cards/${card3Id}"]`);
    await waitFor(`[data-test-card-view="${card3Id}"]`, { timeout });

    assert.equal(currentURL(), `/cards/${card3Id}`);
  });
});