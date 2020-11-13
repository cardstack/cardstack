import { module, test } from 'qunit';
import { visit, currentURL, waitFor, click, triggerEvent } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import {
  waitForCardLoad,
  waitForSchemaViewToLoad,
  encodeColons,
  waitForTestsToEnd,
  waitForLibraryServiceToIdle,
} from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { cardDocument } from '@cardstack/hub';
import { animationsSettled } from 'ember-animated/test-support';

const csRealm = 'http://localhost:3000/api/realms/default';
const org = 'bunny-records';
const collection = 'master-recording';
const testCard = cardDocument().withAutoAttributes({
  csRealm,
  csId: 'entry',
  csTitle: 'Puppy',
  title: 'The Millenial Puppy',
});
const testCard2 = cardDocument().withAutoAttributes({
  csRealm,
  csId: 'entry-2',
  csTitle: 'Puppy',
  title: 'Jackie Wackie',
});
const cardPath = encodeURIComponent(testCard.canonicalURL);
const scenario = new Fixtures({
  create: [testCard, testCard2],
});

async function waitForCollectionCardsLoad() {
  await waitForLibraryServiceToIdle();
  await Promise.all([testCard, testCard2].map(card => waitForCardLoad(card.canonicalURL)));
}

module('Acceptance | logged-out', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupModule(hooks);
  hooks.afterEach(async function() {
    await waitForTestsToEnd();
  });

  test('viewing a card while logged out', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);

    await triggerEvent('[data-test-toggle-left-edge]', 'mouseenter');
    await click('[data-test-logout-button]');
    await animationsSettled();

    await triggerEvent('[data-test-toggle-left-edge]', 'mouseenter');
    await animationsSettled();
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);
    assert.dom('[data-test-library-button]').isDisabled();
    assert.dom('[data-test-catalog-button]').isDisabled();
    assert.dom('[data-test-card-renderer-controls]').doesNotExist();
    await percySnapshot(assert);

    await triggerEvent('[data-test-toggle-left-edge]', 'mouseenter');
    await click('[data-test-login-button]');
    await waitFor('[data-test-card-renderer-controls]');
    await animationsSettled();
    assert.dom('[data-test-mode-indicator-link="view"]').exists();
    assert.dom('[data-test-card-renderer-dropdown-menu]').exists();
  });

  test('edit route redirects to view for unauthenticated users', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}/edit`);
    await waitForCardLoad();

    assert.equal(currentURL(), `/cards/${cardPath}/edit`);
    await triggerEvent('[data-test-toggle-left-edge]', 'mouseenter');
    await click('[data-test-logout-button]');
    await animationsSettled();
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);

    await visit(`/cards/${cardPath}/edit`);
    await waitForCardLoad();
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);
  });

  test('schema route redirects to view for unauthenticated users', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}/configure/fields`);
    await waitForSchemaViewToLoad();

    assert.equal(currentURL(), `/cards/${cardPath}/configure/fields`);
    await triggerEvent('[data-test-toggle-left-edge]', 'mouseenter');
    await click('[data-test-logout-button]');
    await animationsSettled();
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);

    await visit(`/cards/${cardPath}/configure/fields`);
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);
  });

  test('layout route redirects to view for unauthenticated users', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}/configure/layout`);
    await waitForCardLoad();

    assert.equal(currentURL(), `/cards/${cardPath}/configure/layout`);
    await triggerEvent('[data-test-toggle-left-edge]', 'mouseenter');
    await click('[data-test-logout-button]');
    await animationsSettled();
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);

    await visit(`/cards/${cardPath}/configure/layout`);
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);
  });

  test('themer route redirects to view for unauthenticated users', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}/configure/layout`);
    await waitForCardLoad();

    await triggerEvent('[data-test-toggle-left-edge]', 'mouseenter');
    await click('[data-test-logout-button]');
    await animationsSettled();

    await visit(`/cards/${cardPath}/configure/layout/themer`);
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);
  });

  test('viewing index page', async function(assert) {
    await login();
    await visit(`/`);

    assert.equal(currentURL(), `/cards/${org}/collection/${collection}`);
    assert.dom('[data-test-isolated-collection]').exists();
    assert.dom('[data-test-cardhost-left-edge]').exists();
    assert.dom('.cardhost-left-edge--nav-button').exists({ count: 4 });
    assert.dom('[data-test-library-button]').isNotDisabled();

    await triggerEvent('[data-test-toggle-left-edge]', 'mouseenter');
    await click('[data-test-logout-button]');
    await animationsSettled();

    assert.equal(currentURL(), `/cards/${org}/collection/${collection}`);
    assert.dom('[data-test-cardhost-left-edge]').exists();
    assert.dom('[data-test-library-button]').isDisabled();
  });

  test('viewing library', async function(assert) {
    await login();
    await visit('/cards/default/collection');
    await waitForCollectionCardsLoad();

    assert.equal(currentURL(), '/cards/default/collection');
    await click('[data-test-library-button]');
    await waitForLibraryServiceToIdle();
    await waitForCardLoad(testCard.canonicalURL);

    await triggerEvent('[data-test-toggle-left-edge]', 'mouseenter');
    await click('[data-test-logout-button]');
    await animationsSettled();

    assert.equal(currentURL(), '/cards/default/collection');
    assert.dom('[data-test-library]').doesNotExist();
    assert.dom('[data-test-isolated-collection-card]').exists({ count: 2 });
    assert.dom('[data-test-cardhost-left-edge]').exists();
    assert.dom('[data-test-library-button]').isDisabled();
  });

  test('can view the org switcher only while logged in', async function(assert) {
    await login();
    await visit('/cards/default/collection');

    assert.equal(currentURL(), `/cards/default/collection`);
    assert.dom('[data-test-org-switcher]').exists({ count: 6 });
    assert.dom(`[data-test-org-switcher="${org}"]`).exists();

    await triggerEvent('[data-test-toggle-left-edge]', 'mouseenter');
    await click('[data-test-logout-button]');
    await animationsSettled();

    assert.dom('[data-test-cardhost-left-edge]').exists();
    assert.dom(`[data-test-org-switcher="${org}"]`).doesNotExist();
  });

  test('can navigate to index page from view mode', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    assert.equal(currentURL(), `/cards/${cardPath}`);

    await triggerEvent('[data-test-toggle-left-edge]', 'mouseenter');
    await click('[data-test-logout-button]');
    await animationsSettled();

    await triggerEvent('[data-test-toggle-left-edge]', 'mouseenter');
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);
    assert.dom('[data-test-home-link]').exists();

    await click('[data-test-home-link]');
    assert.equal(currentURL(), `/cards/${org}/collection/${collection}`);
  });

  test('clicking outside the login panel closes it', async function(assert) {
    await visit(`/`);
    await triggerEvent('[data-test-toggle-left-edge]', 'mouseenter');
    await click('[data-test-logout-button]');

    await waitFor('[data-test-login-button]');
    assert.dom('[data-test-login-button]').exists();
    await click('[data-test-isolated-collection]');
    assert.dom('[data-test-login-button]').doesNotExist();
  });
});
