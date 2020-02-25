import { module, test } from 'qunit';
import { visit, currentURL, waitFor, click } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import {
  waitForCardLoad,
  waitForSchemaViewToLoad,
  encodeColons,
  waitForCatalogEntriesToLoad,
} from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { cardDocument } from '@cardstack/core/card-document';
import { myOrigin } from '@cardstack/core/origin';
import { animationsSettled } from 'ember-animated/test-support';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';

const csRealm = `${myOrigin}/api/realms/first-ephemeral-realm`;
const testCard = cardDocument().withAutoAttributes({
  csRealm,
  csId: 'millenial-puppies',
  title: 'The Millenial Puppy',
});
const entry = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'entry',
    csTitle: 'The Millenial Puppy',
    type: 'featured',
  })
  .withRelationships({ card: testCard })
  .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'catalog-entry' });
const cardPath = encodeURIComponent(testCard.canonicalURL);
const scenario = new Fixtures({
  create: [testCard, entry],
});

async function waitForFeaturedCardsLoad() {
  await waitForCatalogEntriesToLoad('[data-test-featured-cards]');
}

module('Acceptance | logged-out', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupModule(hooks);

  test('viewing a card while logged out', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    assert.equal(currentURL(), `/cards/${cardPath}`);

    await click('[data-test-toggle-left-edge]');
    await click('[data-test-logout-button]');
    await animationsSettled();

    await click('[data-test-toggle-left-edge]');
    await animationsSettled();
    assert.equal(currentURL(), `/cards/${cardPath}`);
    assert.dom('[data-test-card-header-button]').doesNotExist();
    await percySnapshot(assert);

    await click('[data-test-toggle-left-edge]');
    await click('[data-test-login-button]');
    await waitFor('[data-test-card-header-button]');
    await animationsSettled();
    assert.dom('[data-test-card-header-button]').exists();
  });

  test('edit route redirects to view for unauthenticated users', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();

    assert.equal(currentURL(), `/cards/${cardPath}/edit/fields`);
    await click('[data-test-toggle-left-edge]');
    await click('[data-test-logout-button]');
    await animationsSettled();
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);

    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);
  });

  test('schema route redirects to view for unauthenticated users', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}/edit/fields/schema`);
    await waitForSchemaViewToLoad();

    assert.equal(currentURL(), `/cards/${cardPath}/edit/fields/schema`);
    await click('[data-test-toggle-left-edge]');
    await click('[data-test-logout-button]');
    await animationsSettled();
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);

    await visit(`/cards/${cardPath}/edit/fields/schema`);
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);
  });

  test('layout route redirects to view for unauthenticated users', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}/edit/layout`);
    await waitForCardLoad();

    assert.equal(currentURL(), `/cards/${cardPath}/edit/layout`);
    await click('[data-test-toggle-left-edge]');
    await click('[data-test-logout-button]');
    await animationsSettled();
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);

    await visit(`/cards/${cardPath}/edit/layout`);
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);
  });

  test('themer route redirects to view for unauthenticated users', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}/edit/layout`);
    await waitForCardLoad();

    await click('[data-test-toggle-left-edge]');
    await click('[data-test-logout-button]');
    await animationsSettled();

    await visit(`/cards/${cardPath}/edit/layout/themer`);
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);
  });

  test('viewing index page when logged out', async function(assert) {
    await visit(`/`);
    await click('[data-test-toggle-left-edge]');
    await click('[data-test-logout-button]');
    await waitForFeaturedCardsLoad();

    assert.equal(currentURL(), `/`);
    assert.dom('[data-test-card-builder]').exists();
    assert.dom('[data-test-featured-card]').exists({ count: 1 });
    assert.dom('[data-test-cardhost-left-edge]').exists();
    assert.dom('[data-test-library-button]').isDisabled();

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    assert.equal(currentURL(), `/cards/${cardPath}`);
    assert.dom('[data-test-library-button]').doesNotExist();
    assert.dom('[data-test-library-link]').exists();

    await click('[data-test-library-link]');
    assert.equal(currentURL(), `/`);
    assert.dom('[data-test-library-button]').isDisabled();
  });

  test('clicking outside the login panel closes it', async function(assert) {
    await visit(`/`);
    await click('[data-test-toggle-left-edge]');
    await click('[data-test-logout-button]');

    await waitFor('[data-test-login-button]');
    assert.dom('[data-test-login-button]').exists();
    await click('[data-test-card-builder]');
    assert.dom('[data-test-login-button]').doesNotExist();
  });
});
