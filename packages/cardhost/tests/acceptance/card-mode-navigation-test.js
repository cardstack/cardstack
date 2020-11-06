import { module, test } from 'qunit';
import { visit, currentURL, click } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import { login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { animationsSettled } from 'ember-animated/test-support';
import { cardDocument } from '@cardstack/hub';
import { waitForCardLoad, waitForSchemaViewToLoad, encodeColons, waitForTestsToEnd } from '../helpers/card-ui-helpers';

const csRealm = `http://localhost:3000/api/realms/default`;
const testCard = cardDocument().withAutoAttributes({
  csRealm,
  csId: 'millenial-puppies',
  title: 'The Millenial Puppy',
});
const cardPath = encodeURIComponent(testCard.canonicalURL);
const scenario = new Fixtures({
  create: [testCard],
});

module('Acceptance | card mode navigation', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupModule(hooks);

  hooks.beforeEach(async function() {
    await login();
  });
  hooks.afterEach(async function() {
    await waitForTestsToEnd();
  });

  test('can use the context menu to switch modes', async function(assert) {
    await visit(`/cards/${cardPath}/configure/fields`);
    await waitForSchemaViewToLoad();
    await animationsSettled();

    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/configure/fields`);
    await click('[data-test-context-menu-button]');
    assert.dom('[data-test-context-menu-items] .checked').hasText('Schema');
    await percySnapshot(assert);

    // schema
    await click('[data-test-context-schema]');
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/configure/fields`);
    assert.dom('[data-test-context-menu-items] .checked').hasText('Schema');

    // layout
    await click('[data-test-context-layout]');
    await waitForCardLoad();
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/configure/layout`);
    // await click('[data-test-context-menu-button]');
    // assert.dom('[data-test-context-menu-items] .checked').hasText('Layout');

    // edit
    await visit(`/cards/${cardPath}/configure/fields`);
    await click('[data-test-context-menu-button]');
    await click('[data-test-context-edit]');
    await waitForCardLoad();
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/edit`);

    // view
    await visit(`/cards/${cardPath}/configure/fields`);
    await click('[data-test-context-menu-button]');
    await click('[data-test-context-view]');
    await waitForCardLoad();
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);
  });

  test('clicking outside the context menu closes it', async function(assert) {
    await visit(`/cards/${cardPath}/configure/fields`);
    await waitForCardLoad();

    await click('[data-test-context-menu-button]');
    assert.dom('[data-test-context-menu-items]').exists();

    await click('[data-test-card-renderer-header]');
    assert.dom('[data-test-context-menu-items]').doesNotExist();
  });
});
