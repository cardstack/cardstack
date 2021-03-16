import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

module('Unit | Service | cardstack-session', function (hooks) {
  setupTest(hooks);

  test('it exists', function (assert) {
    let service = this.owner.lookup('service:cardstack-session');
    assert.ok(service);
  });

  test('authentication state defaults to false', function (assert) {
    let service = this.owner.lookup('service:cardstack-session');
    assert.equal(service.isAuthenticated, false);
  });

  test('can set authentication state', async function (assert) {
    let service = this.owner.lookup('service:cardstack-session');

    await service.login();
    assert.equal(service.isAuthenticated, true);

    await service.logout();
    assert.equal(service.isAuthenticated, false);
  });
});
