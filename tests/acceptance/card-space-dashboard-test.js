import { module, test } from 'qunit';
import { visit, currentURL, click } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';

module('Acceptance | card space dashboard', function (hooks) {
  setupApplicationTest(hooks);

  test('visiting /cardstack/card-space', async function (assert) {
    await visit('/scenarios/cardstack/card-space');
    assert.equal(currentURL(), '/scenarios/cardstack/card-space');

    assert.dom('[data-test-card-space-dashboard]').exists();
    assert.dom('[data-test-left-edge-nav]').exists();
    assert.dom('[data-test-cardstack-login-button]').exists();
    assert.dom('[data-test-card-space-create-button]').exists();
  });

  test('can navigate to /cardstack using the left-edge', async function (assert) {
    await visit('/scenarios/cardstack/card-space');
    assert.equal(currentURL(), '/scenarios/cardstack/card-space');

    assert.dom('[data-test-card-space-dashboard]').exists();
    assert.dom('[data-test-left-edge-nav-home-button]').exists();

    await click('[data-test-left-edge-nav-home-button]');
    assert.equal(currentURL(), '/scenarios/cardstack');

    assert.dom('[data-test-cardstack-dashboard]').exists();
  });

  test('logging in', async function (assert) {
    let service = this.owner.lookup('service:cardstack-session');

    await visit('/scenarios/cardstack/card-space');
    assert.equal(currentURL(), '/scenarios/cardstack/card-space');
    assert.equal(service.isAuthenticated, false);

    assert.dom('[data-test-left-edge-nav]').exists();

    await click('[data-test-cardstack-login-button]');
    assert.equal(service.isAuthenticated, true);

    assert.dom('[data-test-left-edge-nav]').exists();
    assert.dom('[data-test-cardstack-login-button]').doesNotExist();

    await click('[data-test-left-edge-nav-home-button]');
    assert.equal(currentURL(), '/scenarios/cardstack');
    assert.equal(service.isAuthenticated, true);

    assert.dom('[data-test-left-edge-nav]').exists();
    assert.dom('[data-test-cardstack-login-button]').doesNotExist();
  });

  test('navigating to create new space while logged out', async function (assert) {
    let service = this.owner.lookup('service:cardstack-session');

    await visit('/scenarios/cardstack/card-space');
    assert.equal(currentURL(), '/scenarios/cardstack/card-space');
    assert.equal(service.isAuthenticated, false);

    await click('[data-test-card-space-create-button]');
    assert.equal(currentURL(), '/scenarios/cardstack/card-space/new');
    assert.equal(service.isAuthenticated, false);

    assert.dom('[data-test-card-space-layout-container]').exists();
    assert.dom('[data-test-left-edge-nav]').doesNotExist();
    assert.dom('[data-test-cardstack-login-button]').exists();
  });

  test('navigating to create new space while logged in', async function (assert) {
    let service = this.owner.lookup('service:cardstack-session');

    await visit('/scenarios/cardstack/card-space');
    assert.equal(currentURL(), '/scenarios/cardstack/card-space');
    await click('[data-test-cardstack-login-button]');
    assert.equal(service.isAuthenticated, true);

    await click('[data-test-card-space-create-button]');
    assert.equal(currentURL(), '/scenarios/cardstack/card-space/new');
    assert.equal(service.isAuthenticated, true);

    assert.dom('[data-test-card-space-layout-container]').exists();
    assert.dom('[data-test-left-edge-nav]').exists();
    assert.dom('[data-test-cardstack-login-button]').doesNotExist();
  });
});
