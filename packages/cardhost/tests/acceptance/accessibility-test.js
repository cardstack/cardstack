import { module, test, skip } from 'qunit';
import { visit, click } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import {
  waitForCardLoad,
  waitForSchemaViewToLoad,
  waitForCatalogEntriesToLoad,
  waitForThemerLoad,
  waitForTestsToEnd,
} from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { cardDocument } from '@cardstack/core/card-document';
import a11yAudit from 'ember-a11y-testing/test-support/audit';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';

const csRealm = `http://localhost:3000/api/realms/default`;
const testCard = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'millenial-puppies',
    csTitle: 'Millenial Puppies',
    csFieldSets: {
      isolated: ['body'],
      embedded: ['body'],
    },
    body: 'test body',
  })
  .withField('body', 'string-field', 'singular', { csTitle: 'Body' });
const featuredEntry = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'featured-entry',
    csTitle: 'Featured: The Millenial Puppy',
    csDescription: 'This super hot article about these puppies that are pooping all over the place.',
    csCreated: '2020-01-01T19:00:00Z',
    type: 'featured',
  })
  .withRelationships({ card: testCard })
  .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'catalog-entry' });
const templateEntry = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'template-entry',
    csTitle: 'Article Template',
    csCreated: '2020-01-01T19:00:00Z',
    type: 'template',
  })
  .withRelationships({ card: testCard })
  .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'catalog-entry' });
const cardPath = encodeURIComponent(testCard.canonicalURL);
const scenario = new Fixtures({
  create: [testCard, featuredEntry, templateEntry],
});

async function waitForCssTransitions() {
  return new Promise(res => setTimeout(() => res(), 1000));
}

async function waitForFeaturedCardsLoad() {
  await waitForCatalogEntriesToLoad('[data-test-featured-cards]');
  await waitForCardLoad(testCard.canonicalURL);
}

async function waitForLibraryLoad() {
  await waitForCatalogEntriesToLoad('[data-test-templates]');
  await waitForCardLoad(testCard.canonicalURL);
}

module('Acceptance | accessibility', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupModule(hooks);

  hooks.beforeEach(async function() {
    await login();
  });
  hooks.afterEach(async function() {
    await waitForTestsToEnd();
  });

  test('basic a11y tests for card view', async function(assert) {
    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    await waitForCssTransitions();
    await a11yAudit();
    assert.ok(true, 'no a11y errors found for view');
  });

  test('basic a11y tests for edit fields', async function(assert) {
    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();
    await waitForCssTransitions();
    await a11yAudit();
    assert.ok(true, 'no a11y errors found for edit fields');
  });

  test('basic a11y tests for layout view', async function(assert) {
    await visit(`/cards/${cardPath}/edit/layout`);
    await waitForCardLoad();
    await waitForCssTransitions();
    await a11yAudit();
    assert.ok(true, 'no a11y errors found for edit layout');
  });

  test('basic a11y tests for schema view', async function(assert) {
    await visit(`/cards/${cardPath}/edit/fields/schema`);
    await waitForSchemaViewToLoad();
    await waitForCssTransitions();
    await a11yAudit();
    assert.ok(true, 'no a11y errors found for schema');
  });

  test('basic a11y tests for themer (FIXME: monaco line numbers failing contrast tests)', async function(assert) {
    await visit(`/cards/${cardPath}/edit/layout/themer`);
    await waitForThemerLoad();
    await waitForCssTransitions();
    await a11yAudit();
    assert.ok(true, 'no a11y errors found for themer');
  });

  // our nav buttons are failing contrast tests
  skip('basic a11y tests for library (FIXME: nav buttons failing contrast test)', async function(assert) {
    await visit('/');
    await waitForFeaturedCardsLoad();
    await waitForCssTransitions();
    await a11yAudit();
    assert.ok(true, 'no a11y errors found for index');

    await click('[data-test-library-button]');
    await waitForLibraryLoad();
    await waitForCssTransitions();
    await a11yAudit();
    assert.ok(true, 'no a11y errors found for library');
  });
});
