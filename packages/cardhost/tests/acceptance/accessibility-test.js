import { module, test } from 'qunit';
import { visit, currentURL, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures';
import { createCards } from '@cardstack/test-support/card-ui-helpers';
import { setupMockUser, login } from '../helpers/login';
import a11yAudit from 'ember-a11y-testing/test-support/audit';

const timeout = 20000;
const card1Id = 'millenial-puppies';
const qualifiedCard1Id = `local-hub::${card1Id}`;

const scenario = new Fixtures({
  create(factory) {
    setupMockUser(factory);
  },
  destroy() {
    return [{ type: 'cards', id: qualifiedCard1Id }];
  },
});

module('Acceptance | accessibility', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);
  hooks.beforeEach(function() {
    this.owner.lookup('service:data')._clearCache();
    this.owner.lookup('service:card-local-storage').clearIds();
  });

  test('basic a11y tests for main routes', async function(assert) {
    await login();
    await createCards({
      [card1Id]: [['body', 'string', false, 'test body']],
    });

    await visit(`/cards/${card1Id}/edit`);
    await waitFor(`[data-test-card-edit="${card1Id}"]`, { timeout });
    assert.equal(currentURL(), `/cards/${card1Id}/edit`);
    await a11yAudit();
    assert.ok(true, 'no a11y errors found for edit');

    await visit(`/cards/${card1Id}/schema`);
    await waitFor(`[data-test-card-schema="${card1Id}"]`, { timeout });
    assert.equal(currentURL(), `/cards/${card1Id}/schema`);
    await a11yAudit();
    assert.ok(true, 'no a11y errors found for schema');

    await visit(`/cards/${card1Id}`);
    await waitFor(`[data-test-card-view="${card1Id}"]`, { timeout });
    assert.equal(currentURL(), `/cards/${card1Id}`);
    await a11yAudit();
    assert.ok(true, 'no a11y errors found for layout');

    await visit(`/cards/${card1Id}/themer`);
    assert.equal(currentURL(), `/cards/${card1Id}/themer`);
    await a11yAudit();
    assert.ok(true, 'no a11y errors found for themer');

    await visit('/');
    assert.equal(currentURL(), `/`);
    assert.ok(true, 'no a11y errors found for index');
  });
});
