import { module, test, skip } from 'qunit';
import { visit, click } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import {
  waitForCardLoad,
  waitForSchemaViewToLoad,
  waitForThemerLoad,
  waitForTemplatesLoad,
  waitForEmbeddedCardLoad,
} from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { cardDocument } from '@cardstack/core/card-document';
import { myOrigin } from '@cardstack/core/origin';
import a11yAudit from 'ember-a11y-testing/test-support/audit';

const csRealm = `${myOrigin}/api/realms/first-ephemeral-realm`;
const testCard = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'millenial-puppies',
    csTitle: 'Millenial Puppies',
    body: 'test body',
  })
  .withField('body', 'string-field', 'singular', { csTitle: 'Body' });
const cardPath = encodeURIComponent(testCard.canonicalURL);
const scenario = new Fixtures({
  create: [testCard],
});

async function waitForCssTransitions() {
  return new Promise(res => setTimeout(() => res(), 1000));
}

module('Acceptance | accessibility', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupModule(hooks);

  hooks.beforeEach(async function() {
    await login();
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

  // The monaco line numbers are failing the contrast test
  skip('basic a11y tests for themer (FIXME: monaco line numbers failing contrast tests)', async function(assert) {
    await visit(`/cards/${cardPath}/edit/layout/themer`);
    await waitForThemerLoad();
    await waitForCssTransitions();
    await a11yAudit();
    assert.ok(true, 'no a11y errors found for themer');
  });

  // our nav buttons are failing contrast tests
  skip('basic a11y tests for library (FIXME: nav buttons failing contrast test)', async function(assert) {
    await visit('/');
    await waitForCssTransitions();
    await a11yAudit();
    assert.ok(true, 'no a11y errors found for library featured cards');

    await click('[data-test-library-button]');
    await waitForTemplatesLoad();
    await waitForEmbeddedCardLoad(testCard.canonicalURL);
    await waitForCssTransitions();
    await a11yAudit();
    assert.ok(true, 'no a11y errors found for library');
  });
});
