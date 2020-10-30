import { module, test } from 'qunit';
import { visit, currentURL, waitFor, click } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import {
  waitForCardLoad,
  waitForSchemaViewToLoad,
  encodeColons,
  waitForTestsToEnd,
  waitForLibraryServiceToIdle,
  CARDS_URL,
} from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { cardDocument } from '@cardstack/hub';
import { animationsSettled } from 'ember-animated/test-support';

const csRealm = 'http://localhost:3000/api/realms/default';
const testCard = cardDocument().withAutoAttributes({
  csRealm,
  csId: 'entry',
  csTitle: 'master-recording',
  title: 'The Millenial Puppy',
});
const testCard2 = cardDocument().withAutoAttributes({
  csRealm,
  csId: 'entry-2',
  csTitle: 'master-recording',
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
    await visit(`${CARDS_URL}/${cardPath}`);
    await waitForCardLoad();
    assert.equal(encodeColons(currentURL()), `${CARDS_URL}/${cardPath}`);

    await click('[data-test-toggle-left-edge]');
    await click('[data-test-logout-button]');
    await animationsSettled();

    await click('[data-test-toggle-left-edge]');
    await animationsSettled();
    assert.equal(encodeColons(currentURL()), `${CARDS_URL}/${cardPath}`);
    assert.dom('[data-test-library-button]').isDisabled();
    assert.dom('[data-test-catalog-button]').isDisabled();
    assert.dom('[data-test-card-renderer-controls]').doesNotExist();
    await percySnapshot(assert);

    await click('[data-test-toggle-left-edge]');
    await click('[data-test-login-button]');
    await waitFor('[data-test-card-renderer-controls]');
    await animationsSettled();
    assert.dom('[data-test-mode-indicator-link="view"]').exists();
    assert.dom('[data-test-card-renderer-dropdown-menu]').exists();
  });

  test('edit route redirects to view for unauthenticated users', async function(assert) {
    await login();
    await visit(`${CARDS_URL}/${cardPath}/edit`);
    await waitForCardLoad();

    assert.equal(currentURL(), `${CARDS_URL}/${cardPath}/edit`);
    await click('[data-test-toggle-left-edge]');
    await click('[data-test-logout-button]');
    await animationsSettled();
    assert.equal(encodeColons(currentURL()), `${CARDS_URL}/${cardPath}`);

    await visit(`${CARDS_URL}/${cardPath}/edit`);
    await waitForCardLoad();
    assert.equal(encodeColons(currentURL()), `${CARDS_URL}/${cardPath}`);
  });

  test('schema route redirects to view for unauthenticated users', async function(assert) {
    await login();
    await visit(`${CARDS_URL}/${cardPath}/configure/fields`);
    await waitForSchemaViewToLoad();

    assert.equal(currentURL(), `${CARDS_URL}/${cardPath}/configure/fields`);
    await click('[data-test-toggle-left-edge]');
    await click('[data-test-logout-button]');
    await animationsSettled();
    assert.equal(encodeColons(currentURL()), `${CARDS_URL}/${cardPath}`);

    await visit(`${CARDS_URL}/${cardPath}/configure/fields`);
    assert.equal(encodeColons(currentURL()), `${CARDS_URL}/${cardPath}`);
  });

  test('layout route redirects to view for unauthenticated users', async function(assert) {
    await login();
    await visit(`${CARDS_URL}/${cardPath}/configure/layout`);
    await waitForCardLoad();

    assert.equal(currentURL(), `${CARDS_URL}/${cardPath}/configure/layout`);
    await click('[data-test-toggle-left-edge]');
    await click('[data-test-logout-button]');
    await animationsSettled();
    assert.equal(encodeColons(currentURL()), `${CARDS_URL}/${cardPath}`);

    await visit(`${CARDS_URL}/${cardPath}/configure/layout`);
    assert.equal(encodeColons(currentURL()), `${CARDS_URL}/${cardPath}`);
  });

  test('themer route redirects to view for unauthenticated users', async function(assert) {
    await login();
    await visit(`${CARDS_URL}/${cardPath}/configure/layout`);
    await waitForCardLoad();

    await click('[data-test-toggle-left-edge]');
    await click('[data-test-logout-button]');
    await animationsSettled();

    await visit(`${CARDS_URL}/${cardPath}/configure/layout/themer`);
    assert.equal(encodeColons(currentURL()), `${CARDS_URL}/${cardPath}`);
  });

  test('viewing index page', async function(assert) {
    await login();
    await visit(`/`);

    assert.equal(currentURL(), `${CARDS_URL}/collection`);
    await waitForCollectionCardsLoad();

    assert.dom('[data-test-isolated-collection]').exists();
    assert.dom('[data-test-isolated-collection-card]').exists({ count: 2 });
    assert.dom('[data-test-cardhost-left-edge]').exists();
    assert.dom('.cardhost-left-edge--nav-button').exists({ count: 4 });
    assert.dom('[data-test-library-button]').isNotDisabled();

    await click('[data-test-toggle-left-edge]');
    await click('[data-test-logout-button]');
    await animationsSettled();

    assert.equal(currentURL(), `${CARDS_URL}/collection`);
    assert.dom('[data-test-isolated-collection-card]').exists({ count: 2 });
    assert.dom('[data-test-cardhost-left-edge]').exists();
    assert.dom('[data-test-library-button]').isDisabled();
  });

  test('viewing library', async function(assert) {
    await login();
    await visit(`/`);

    assert.equal(currentURL(), `${CARDS_URL}/collection`);
    await click('[data-test-library-button]');
    await waitForLibraryServiceToIdle();
    await waitForCardLoad(testCard.canonicalURL);

    await click('[data-test-toggle-left-edge]');
    await click('[data-test-logout-button]');
    await animationsSettled();

    assert.equal(currentURL(), `${CARDS_URL}/collection`);
    assert.dom('[data-test-library]').doesNotExist();
    assert.dom('[data-test-isolated-collection-card]').exists({ count: 2 });
    assert.dom('[data-test-cardhost-left-edge]').exists();
    assert.dom('[data-test-library-button]').isDisabled();
  });

  test('can navigate to index page from view mode', async function(assert) {
    await login();
    await visit(`${CARDS_URL}/${cardPath}`);
    await waitForCardLoad();
    assert.equal(currentURL(), `${CARDS_URL}/${cardPath}`);

    await click('[data-test-toggle-left-edge]');
    await click('[data-test-logout-button]');
    await animationsSettled();

    await click('[data-test-toggle-left-edge]');
    assert.equal(encodeColons(currentURL()), `${CARDS_URL}/${cardPath}`);
    assert.dom('[data-test-home-link]').exists();

    await click('[data-test-home-link]');
    assert.equal(currentURL(), `${CARDS_URL}/collection`);
  });

  test('clicking outside the login panel closes it', async function(assert) {
    await visit(`/`);
    await click('[data-test-toggle-left-edge]');
    await click('[data-test-logout-button]');

    await waitFor('[data-test-login-button]');
    assert.dom('[data-test-login-button]').exists();
    await click('[data-test-isolated-collection]');
    assert.dom('[data-test-login-button]').doesNotExist();
  });
});
