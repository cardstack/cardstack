import { module, test } from 'qunit';
import { visit, currentURL, triggerEvent, waitFor, click } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures';
import { setupMockUser, login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';

const scenario = new Fixtures({
  create(factory) {
    setupMockUser(factory);
  },
});

module('Acceptance | card mode navigation', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);
  hooks.beforeEach(function() {
    this.owner.lookup('service:data')._clearCache();
    this.owner.lookup('service:card-local-storage').clearIds();
  });

  test('can use the context menu to switch modes', async function(assert) {
    await login();
    // edit
    await visit(`/cards/@cardstack%2Fbase-card/edit/fields`);
    assert.equal(currentURL(), `/cards/@cardstack%2Fbase-card/edit/fields`);
    await click('[data-test-context-menu-button]');
    assert.dom('[data-test-context-menu-items] .checked').hasText('Edit');
    // snapshot
    await percySnapshot(assert);
    // schema
    await click('[data-test-context-schema]');
    assert.equal(currentURL(), `/cards/@cardstack%2Fbase-card/edit/fields/schema`);
    await click('[data-test-context-menu-button]');
    assert.dom('[data-test-context-menu-items] .checked').hasText('Schema');
    // layout
    await click('[data-test-context-layout]');
    assert.equal(currentURL(), `/cards/@cardstack%2Fbase-card/edit/layout`);
    await click('[data-test-context-menu-button]');
    assert.dom('[data-test-context-menu-items] .checked').hasText('Layout');
    // view
    await click('[data-test-context-view]');
    assert.equal(currentURL(), `/cards/@cardstack%2Fbase-card`);
    await triggerEvent('[data-test-card-renderer]', 'mouseenter');
    await waitFor('[data-test-context-menu-button]');
    await click('[data-test-context-menu-button]');
    assert.dom('[data-test-context-menu-items] .checked').hasText('View');
  });

  test('clicking outside the context menu closes it', async function(assert) {
    await login();
    await visit(`/cards/@cardstack%2Fbase-card/edit/fields`);
    assert.equal(currentURL(), `/cards/@cardstack%2Fbase-card/edit/fields`);
    await click('[data-test-context-menu-button]');
    assert.dom('[data-test-context-menu-items]').exists();
    await click('[data-test-card-renderer-header]');
    assert.dom('[data-test-context-menu-items]').doesNotExist();
  });
});
