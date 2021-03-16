import { module, test } from 'qunit';
import { visit, currentURL, click } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';

module('Acceptance | cardstack dashboard', function (hooks) {
  setupApplicationTest(hooks);

  test('visiting /cardstack', async function (assert) {
    await visit('/scenarios/cardstack');
    assert.equal(currentURL(), '/scenarios/cardstack');

    assert.dom('[data-test-cardstack-dashboard]').exists();
    assert.dom('[data-test-cardstack-dashboard-header]').hasText('Cardstack');
    assert.dom('[data-test-cardstack-login-button]').exists();
    assert.dom('[data-test-left-edge-nav]').exists();
    assert.dom('[data-test-cardstack-dashboard-link="card-space"]').exists();
    assert.dom('[data-test-cardstack-dashboard-link="card-pay"]').exists();
  });

  test('can navigate to /card-space', async function (assert) {
    await visit('/scenarios/cardstack');
    assert.equal(currentURL(), '/scenarios/cardstack');
    assert.dom('[data-test-cardstack-dashboard]').exists();

    await click('[data-test-cardstack-dashboard-link="card-space"]');
    assert.equal(currentURL(), '/scenarios/cardstack/card-space');
    assert.dom('[data-test-card-space-dashboard]').exists();
  });

  test('logging in', async function (assert) {
    let service = this.owner.lookup('service:cardstack-session');

    await visit('/scenarios/cardstack');
    assert.equal(currentURL(), '/scenarios/cardstack');
    assert.equal(service.isAuthenticated, false);
    assert.dom('[data-test-left-edge-nav]').exists();

    await click('[data-test-cardstack-login-button]');
    assert.equal(service.isAuthenticated, true);
    assert.dom('[data-test-left-edge-nav]').exists();
    assert.dom('[data-test-cardstack-login-button]').doesNotExist();

    await click('[data-test-cardstack-dashboard-link="card-space"]');
    assert.equal(currentURL(), '/scenarios/cardstack/card-space');
    assert.equal(service.isAuthenticated, true);
    assert.dom('[data-test-left-edge-nav]').exists();
    assert.dom('[data-test-cardstack-login-button]').doesNotExist();
  });

  test('can navigate to /card-pay', async function (assert) {
    await visit('/scenarios/cardstack');
    assert.equal(currentURL(), '/scenarios/cardstack');

    await click('[data-test-cardstack-dashboard-link="card-pay"]');
    assert.equal(currentURL(), '/scenarios/cardstack/card-pay');

    assert.dom('[data-test-card-pay-dashboard]').exists();
    assert.dom('[data-test-left-edge-nav]').doesNotExist();
    assert.dom('[data-test-cardstack-login-button]').doesNotExist();
  });
});
