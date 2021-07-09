import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

module('Unit | Service | Layer2Network', function (hooks) {
  setupTest(hooks);

  // Replace this with your real tests.
  test('it exists', function (assert) {
    let service = this.owner.lookup('service:layer2-network');
    assert.ok(service);
  });

  test('it clears the auth token when onDisconnect is called', function (assert) {
    let hubAuthentication = this.owner.lookup('service:hub-authentication');
    hubAuthentication.authToken = 'something';
    assert.equal(hubAuthentication.authToken, 'something');
    let layer2Network = this.owner.lookup('service:layer2-network');
    layer2Network.onDisconnect();
    assert.equal(hubAuthentication.authToken, null);
  });
});
