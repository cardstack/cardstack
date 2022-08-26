import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';
import Layer2Network from '@cardstack/web-client/services/layer2-network';

module('Unit | Service | Layer2Network', function (hooks) {
  setupTest(hooks);

  // Replace this with your real tests.
  test('it exists', function (assert) {
    let service = this.owner.lookup('service:layer2-network');
    assert.ok(service);
  });

  test('it clears the auth token when onDisconnect is called', function (assert) {
    let hubAuthentication = this.owner.lookup(
      'service:hub-authentication'
    ) as HubAuthentication;
    hubAuthentication.authToken = 'something';
    assert.strictEqual(hubAuthentication.authToken, 'something');
    let layer2Network = this.owner.lookup(
      'service:layer2-network'
    ) as Layer2Network;
    layer2Network.onDisconnect();
    assert.strictEqual(hubAuthentication.authToken, null);
  });
});
