import { module, test } from 'qunit';
import { visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import { waitForCardLoad, waitForSchemaViewToLoad, waitForThemerLoad } from '../helpers/card-ui-helpers';
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

module('Acceptance | accessibility', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupModule(hooks);

  test('basic a11y tests for main routes', async function(assert) {
    await login();

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    await a11yAudit();
    assert.ok(true, 'no a11y errors found for view');

    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();
    await a11yAudit();
    assert.ok(true, 'no a11y errors found for edit fields');

    await visit(`/cards/${cardPath}/edit/layout`);
    await waitForCardLoad();
    await a11yAudit();
    assert.ok(true, 'no a11y errors found for edit layout');

    await visit(`/cards/${cardPath}/edit/fields/schema`);
    await waitForSchemaViewToLoad();
    await a11yAudit();
    assert.ok(true, 'no a11y errors found for schema');

    await visit(`/cards/${cardPath}/edit/layout/themer`);
    await waitForThemerLoad();
    await a11yAudit();
    assert.ok(true, 'no a11y errors found for themer');

    await visit('/');
    assert.ok(true, 'no a11y errors found for index');
  });
});
