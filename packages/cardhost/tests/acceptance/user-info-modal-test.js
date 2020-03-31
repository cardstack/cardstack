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
});

module('Acceptance | user info modal', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);
  hooks.beforeEach(async function(assert) {
    await login();
    let controller = this.owner.lookup('controller:cards');
    assert.equal(controller.hideDialog, true, 'dialog is not displayed');
    controller.set('hideDialog', true);
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
    assert.dom('[data-test-user-info-modal]').exists();

    await visit(`/cards/${cardPath}/edit/fields`);
    assert.dom('[data-test-user-info-modal]').exists();

    await visit(`/cards/${cardPath}/edit/fields/schema`);
    assert.dom('[data-test-user-info-modal]').exists();

    await visit(`/cards/${cardPath}/edit/layout`);
    assert.dom('[data-test-user-info-modal]').exists();

    await visit(`/cards/${cardPath}/edit/layout/themer`);
    assert.dom('[data-test-user-info-modal]').exists();

    await visit(`/cards/${cardPath}/edit/preview`);
    assert.dom('[data-test-user-info-modal]').exists();
  });

  test('after closing, remains closed during page transitions', async function(assert) {
    await visit('/');
    assert.equal(currentURL(), '/cards');
    assert.dom('[data-test-user-info-modal]').exists();
    await click(`[data-test-user-info-modal] button`);
    assert.dom('[data-test-user-info-modal]').doesNotExist();

    await waitForCatalogEntriesToLoad();
    await click(`[data-test-featured-card]`);

    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);
    assert.dom('[data-test-user-info-modal]').doesNotExist();

    await waitForCardLoad();
    await click(`[data-test-card-header-button]`);
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/edit/fields`);
    assert.dom('[data-test-user-info-modal]').doesNotExist();

    await click(`[data-test-configure-schema-btn]`);
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/edit/fields/schema`);
    assert.dom('[data-test-user-info-modal]').doesNotExist();
  });
});
