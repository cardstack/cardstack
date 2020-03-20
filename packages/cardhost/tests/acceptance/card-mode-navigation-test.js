import { module, test } from 'qunit';
import { visit, currentURL, click, triggerEvent, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import { login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { cardDocument } from '@cardstack/core/card-document';
import {
  waitForCardLoad,
  waitForSchemaViewToLoad,
  encodeColons,
  waitForTestsToEnd,
  setCardName,
} from '../helpers/card-ui-helpers';

const csRealm = `http://localhost:3000/api/realms/default`;
const testCard = cardDocument().withAutoAttributes({
  csRealm,
  csId: 'millenial-puppies',
  title: 'The Millenial Puppy',
});
const cardPath = encodeURIComponent(testCard.canonicalURL);

const adoptableTestCard = cardDocument().withAutoAttributes({
  csRealm,
  csId: 'gen-z-puppies',
  title: 'The Gen Z Puppy',
});
const adoptableCardPath = encodeURIComponent(adoptableTestCard.canonicalURL);
const scenario = new Fixtures({
  create: [testCard, adoptableTestCard],
  destroy: {
    cardTypes: [adoptableTestCard],
  },
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
    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();

    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/edit/fields`);
    await click('[data-test-context-menu-button]');
    assert.dom('[data-test-context-menu-items] .checked').hasText('Edit');
    await percySnapshot(assert);

    // schema
    await click('[data-test-context-schema]');
    await waitForSchemaViewToLoad();
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/edit/fields/schema`);
    await click('[data-test-context-menu-button]');
    assert.dom('[data-test-context-menu-items] .checked').hasText('Schema');

    // layout
    await click('[data-test-context-layout]');
    await waitForCardLoad();
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/edit/layout`);
    await click('[data-test-context-menu-button]');
    assert.dom('[data-test-context-menu-items] .checked').hasText('Layout');

    // edit
    await click('[data-test-context-edit]');
    await waitForCardLoad();
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/edit/fields`);
    await click('[data-test-context-menu-button]');
    assert.dom('[data-test-context-menu-items] .checked').hasText('Edit');

    // view
    await click('[data-test-context-view]');
    await waitForCardLoad();
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);
    await triggerEvent('[data-test-card-renderer]', 'mouseenter');
    await waitFor('[data-test-context-menu-button]');
    await click('[data-test-context-menu-button]');
    assert.dom('[data-test-context-menu-items] .checked').hasText('View');
  });

  test('can use the context menu to adopt from a card', async function(assert) {
    await visit(`/cards/${adoptableCardPath}/edit/fields`);
    await waitForCardLoad();

    assert.equal(encodeColons(currentURL()), `/cards/${adoptableCardPath}/edit/fields`);
    await click('[data-test-context-menu-button]');

    await click('[data-test-context-adopt]');
    await waitFor('[data-test-card-name]');
    let adopteeCardName = 'Adopted Gen Z Puppies';
    await setCardName(adopteeCardName);
    assert.ok(/^\/cards\/.*\/edit\/fields$/.test(currentURL()), 'URL is correct');
    assert.dom('.card-renderer-isolated--header-title').hasText(adopteeCardName);
  });

  test('clicking outside the context menu closes it', async function(assert) {
    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();

    await click('[data-test-context-menu-button]');
    assert.dom('[data-test-context-menu-items]').exists();

    await click('[data-test-card-renderer-header]');
    assert.dom('[data-test-context-menu-items]').doesNotExist();
  });
});
