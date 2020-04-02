import { module, test } from 'qunit';
import { visit, currentURL, click } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import { login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import {
  waitForTestsToEnd,
  waitForCatalogEntriesToLoad,
  waitForCardLoad,
  encodeColons,
  waitForSchemaViewToLoad,
  waitForThemerLoad,
} from '../helpers/card-ui-helpers';
import { cardDocument, CARDSTACK_PUBLIC_REALM } from '@cardstack/hub';

const csRealm = 'https://cardstack.com/api/realms/card-catalog';
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
  destroy: {
    cardTypes: [{ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' }],
  },
});

module('Acceptance | user info modal', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);
  hooks.beforeEach(async function(assert) {
    await login();
    let controller = this.owner.lookup('controller:cards');
    assert.equal(controller.hideDialog, true, 'dialog is hidden');
    controller.set('hideDialog', false);
    assert.equal(controller.hideDialog, false, 'dialog is displayed');
  });
  hooks.afterEach(async function() {
    await waitForTestsToEnd();
  });

  test('it appears on page load', async function(assert) {
    await visit('/');
    assert.equal(currentURL(), '/cards');
    assert.dom('[data-test-user-info-modal]').exists();
    assert.dom('[data-test-dialog-title]').hasText('Important Notice');
    assert.dom('[data-test-dialog-content]').hasAnyText();
    await percySnapshot(assert);

    await visit(`/cards/${cardPath}`);
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);
    assert.dom('[data-test-user-info-modal]').exists('modal exists in view mode');

    await visit(`/cards/${cardPath}/edit/fields`);
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/edit/fields`);
    assert.dom('[data-test-user-info-modal]').exists('modal exists in fields mode');

    await visit(`/cards/${cardPath}/edit/fields/schema`);
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/edit/fields/schema`);
    assert.dom('[data-test-user-info-modal]').exists('modal exists in schema mode');

    await visit(`/cards/${cardPath}/edit/layout`);
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/edit/layout`);
    assert.dom('[data-test-user-info-modal]').exists('modal exists in layout mode');

    await visit(`/cards/${cardPath}/edit/layout/themer`);
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/edit/layout/themer`);
    assert.dom('[data-test-user-info-modal]').exists('modal exists in themer mode');

    await visit(`/cards/${cardPath}/edit/preview`);
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/edit/preview`);
    assert.dom('[data-test-user-info-modal]').exists('modal exists in preview mode');
  });

  test('it appears on /add route', async function(assert) {
    await visit(`/cards/add`);
    assert.equal(currentURL(), `/cards/add`);
    assert.dom('[data-test-user-info-modal]').exists('modal exists in /add route');
  });

  test('it appears on /adopt route', async function(assert) {
    await visit(`/cards/${cardPath}/adopt`);
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/adopt`);
    assert.dom('[data-test-user-info-modal]').exists('modal exists in /adopt route');
  });

  test('when the user closes the modal, it remains closed', async function(assert) {
    await visit('/');
    assert.equal(currentURL(), '/cards');
    assert.dom('[data-test-user-info-modal]').exists();

    await click(`[data-test-user-info-modal] button`);
    assert.equal(currentURL(), '/cards?confirmed=true');
    assert.dom('[data-test-user-info-modal]').doesNotExist();

    await waitForCatalogEntriesToLoad();
    await click(`[data-test-featured-card]`);

    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}?confirmed=true`);
    assert.dom('[data-test-user-info-modal]').doesNotExist('modal is hidden in view mode');

    await waitForCardLoad();
    await click(`[data-test-card-header-button]`);
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/edit/fields?confirmed=true`);
    assert.dom('[data-test-user-info-modal]').doesNotExist('modal is hidden in fields mode');

    await click(`[data-test-configure-schema-btn]`);
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/edit/fields/schema?confirmed=true`);
    assert.dom('[data-test-user-info-modal]').doesNotExist('modal is hidden in schema mode');

    await waitForSchemaViewToLoad();
    await click(`[data-test-mode-indicator-link="edit"]`);
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/edit/fields?confirmed=true`);
    await click(`[data-test-view-selector="layout"]`);
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/edit/layout?confirmed=true`);
    assert.dom('[data-test-user-info-modal]').doesNotExist('modal is hidden in layout mode');

    await waitForCardLoad();
    await click('[data-test-card-custom-style-button]');
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/edit/layout/themer?confirmed=true`);
    assert.dom('[data-test-user-info-modal]').doesNotExist('modal is hidden in themer mode');

    await waitForThemerLoad();
    await click(`[data-test-themer-preview-button]`);
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/edit/preview?confirmed=true`);
    assert.dom('[data-test-user-info-modal]').doesNotExist('modal is hidden in preview mode');
  });
});
