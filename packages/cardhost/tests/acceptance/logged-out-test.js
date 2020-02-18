import { module, test } from 'qunit';
import { visit, currentURL, waitFor, click } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import { waitForCardLoad, waitForSchemaViewToLoad } from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { cardDocument } from '@cardstack/core/card-document';
import { myOrigin } from '@cardstack/core/origin';
import { animationsSettled } from 'ember-animated/test-support';

const csRealm = `${myOrigin}/api/realms/first-ephemeral-realm`;
const testCard = cardDocument().withAutoAttributes({
  csRealm,
  csId: 'millenial-puppies',
  title: 'The Millenial Puppy',
});
const cardPath = encodeURIComponent(testCard.canonicalURL);
const scenario = new Fixtures({
  create: [testCard],
});

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
    assert.dom('[data-test-card-edit-link]').doesNotExist();
    await percySnapshot(assert);

    await click('[data-test-toggle-left-edge]');
    await click('[data-test-login-button]');
    await waitFor('[data-test-card-edit-link]');
    await animationsSettled();
    assert.dom('[data-test-card-edit-link]').exists();
  });

  test('edit route redirects to view for unauthenticated users', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();

    assert.equal(currentURL(), `/cards/${cardPath}/edit/fields`);
    await click('[data-test-toggle-left-edge]');
    await click('[data-test-logout-button]');
    await animationsSettled();
    assert.equal(currentURL().replace(/:/g, encodeURIComponent(':')), `/cards/${cardPath}`);

    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();
    assert.equal(currentURL().replace(/:/g, encodeURIComponent(':')), `/cards/${cardPath}`);
  });

  test('schema route redirects to view for unauthenticated users', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}/edit/fields/schema`);
    await waitForSchemaViewToLoad();

    assert.equal(currentURL(), `/cards/${cardPath}/edit/fields/schema`);
    await click('[data-test-toggle-left-edge]');
    await click('[data-test-logout-button]');
    await animationsSettled();
    assert.equal(currentURL().replace(/:/g, encodeURIComponent(':')), `/cards/${cardPath}`);

    await visit(`/cards/${cardPath}/edit/fields/schema`);
    assert.equal(currentURL().replace(/:/g, encodeURIComponent(':')), `/cards/${cardPath}`);
  });

  test('layout route redirects to view for unauthenticated users', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}/edit/layout`);
    await waitForCardLoad();

    assert.equal(currentURL(), `/cards/${cardPath}/edit/layout`);
    await click('[data-test-toggle-left-edge]');
    await click('[data-test-logout-button]');
    await animationsSettled();
    assert.equal(currentURL().replace(/:/g, encodeURIComponent(':')), `/cards/${cardPath}`);

    await visit(`/cards/${cardPath}/edit/layout`);
    assert.equal(currentURL().replace(/:/g, encodeURIComponent(':')), `/cards/${cardPath}`);
  });

  test('themer route redirects to view for unauthenticated users', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}/edit/layout`);
    await waitForCardLoad();

    await click('[data-test-toggle-left-edge]');
    await click('[data-test-logout-button]');
    await animationsSettled();

    await visit(`/cards/${cardPath}/edit/layout/themer`);
    assert.equal(currentURL().replace(/:/g, encodeURIComponent(':')), `/cards/${cardPath}`);
  });
});
