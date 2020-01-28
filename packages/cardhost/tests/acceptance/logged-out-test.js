import { module, test } from 'qunit';
import { visit, currentURL, waitFor, click } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures';
import { createCards } from '@cardstack/test-support/card-ui-helpers';
import { setupMockUser, login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';

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

module('Acceptance | logged-out', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);
  hooks.beforeEach(function() {
    this.owner.lookup('service:data')._clearCache();
    this.owner.lookup('service:card-local-storage').clearIds();
  });

  test('viewing a card while logged out', async function(assert) {
    await login();
    await createCards({
      [card1Id]: [['title', 'string', true, 'The Millenial Puppy']],
    });
    await visit(`/cards/${card1Id}`);
    assert.equal(currentURL(), `/cards/${card1Id}`);
    await click('[data-test-toggle-left-edge]');
    await click('[data-test-logout-button]');
    await click('[data-test-toggle-left-edge]');
    assert.equal(currentURL(), `/cards/${card1Id}`);

    assert.dom('[data-test-card-edit-link]').doesNotExist();
    await percySnapshot(assert);
    await click('[data-test-toggle-left-edge]');
    await click('[data-test-login-button]');
    await waitFor('[data-test-card-edit-link]');
    assert.dom('[data-test-card-edit-link]').exists();
  });

  test('edit route redirects to view for unauthenticated users', async function(assert) {
    await login();
    await createCards({
      [card1Id]: [['title', 'string', true, 'The Millenial Puppy']],
    });
    await visit(`/cards/${card1Id}/edit/fields`);
    assert.equal(currentURL(), `/cards/${card1Id}/edit/fields`);
    await click('[data-test-toggle-left-edge]');
    await click('[data-test-logout-button]');
    await visit(`/cards/${card1Id}/edit/fields`);
    assert.equal(currentURL(), `/cards/${card1Id}`);
  });

  test('schema route redirects to view for unauthenticated users', async function(assert) {
    await login();
    await createCards({
      [card1Id]: [['title', 'string', true, 'The Millenial Puppy']],
    });
    await visit(`/cards/${card1Id}/edit/fields/schema`);
    assert.equal(currentURL(), `/cards/${card1Id}/edit/fields/schema`);
    await click('[data-test-toggle-left-edge]');
    await click('[data-test-logout-button]');
    await visit(`/cards/${card1Id}/edit/fields/schema`);
    assert.equal(currentURL(), `/cards/${card1Id}`);
  });
});
