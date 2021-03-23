import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

module('Unit | Service | Layer2Network', function (hooks) {
  setupTest(hooks);

  // Replace this with your real tests.
  test('it exists', function (assert) {
    let service = this.owner.lookup('service:layer2-network');
    assert.ok(service);
  });
});
