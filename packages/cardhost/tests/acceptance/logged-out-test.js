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

    assert.dom('[data-test-card-header-button]').doesNotExist();
    await percySnapshot(assert);
    await click('[data-test-toggle-left-edge]');
    await click('[data-test-login-button]');
    await waitFor('[data-test-card-header-button]');
    assert.dom('[data-test-card-header-button]').exists();
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

  test('viewing index page', async function(assert) {
    await visit(`/`);
    assert.equal(currentURL(), `/`);
    assert.dom('[data-test-card-builder]').exists();
    assert.dom('[data-test-featured-card]').exists({ count: 4 });
    assert.dom('[data-test-cardhost-left-edge]').exists();
    assert.dom('[data-test-library-button]').isDisabled();

    await click('[data-test-featured-card="product-card"]');
    assert.equal(currentURL(), `/cards/product-card`);
    assert.dom('[data-test-library-button]').doesNotExist();
    assert.dom('[data-test-library-link]').exists();

    await click('[data-test-library-link]');
    assert.equal(currentURL(), `/`);
    assert.dom('[data-test-library-button]').isDisabled();
  });

  test('clicking outside the login panel closes it', async function(assert) {
    await visit(`/`);
    assert.equal(currentURL(), `/`);
    await waitFor('[data-test-toggle-left-edge]');
    await click('[data-test-toggle-left-edge]');
    await waitFor('[data-test-login-button]');
    assert.dom('[data-test-login-button]').exists();
    await click('[data-test-card-builder]');
    assert.dom('[data-test-login-button]').doesNotExist();
  });
});
