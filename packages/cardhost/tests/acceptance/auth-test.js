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

const scenario = new Fixtures({
  create(factory) {
    setupMockUser(factory);
  },
  destroy() {
    return [{ type: 'cards', id: qualifiedCard1Id }];
  },
});

module('Acceptance | auth', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);
  hooks.beforeEach(function() {
    this.owner.lookup('service:data')._clearCache();
  });

  test('viewing a card while logged out', async function(assert) {
    await login();
    await createCards({
      [card1Id]: [['title', 'string', true, 'The Millenial Puppy']],
    });
    await visit(`/cards/${card1Id}`);
    assert.equal(currentURL(), `/cards/${card1Id}`);
    await click('#logout-button');
    assert.equal(currentURL(), `/cards/${card1Id}`);

    assert.dom('[data-test-mode-switcher]').doesNotExist();
    assert.dom('[data-test-card-save-btn]').doesNotExist();
    assert.dom('[data-test-right-edge]').doesNotExist();
    await percySnapshot(assert);
    await login();
    assert.dom('[data-test-mode-switcher]').exists();
    assert.dom('[data-test-card-save-btn]').exists();
    assert.dom('[data-test-right-edge]').exists();
  });

  test('edit route redirects to view for unauthenticated users', async function(assert) {
    await login();
    await createCards({
      [card1Id]: [['title', 'string', true, 'The Millenial Puppy']],
    });
    await visit(`/cards/${card1Id}/edit`);
    assert.equal(currentURL(), `/cards/${card1Id}/edit`);
    await click('#logout-button');
    await visit(`/cards/${card1Id}/edit`);
    assert.equal(currentURL(), `/cards/${card1Id}`);
  });

  test('schema route redirects to view for unauthenticated users', async function(assert) {
    await login();
    await createCards({
      [card1Id]: [['title', 'string', true, 'The Millenial Puppy']],
    });
    await visit(`/cards/${card1Id}/schema`);
    assert.equal(currentURL(), `/cards/${card1Id}/schema`);
    await click('#logout-button');
    await visit(`/cards/${card1Id}/schema`);
    assert.equal(currentURL(), `/cards/${card1Id}`);
  });
});
