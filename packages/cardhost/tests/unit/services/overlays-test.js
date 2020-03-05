import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

module('Unit | Service | overlays', function(hooks) {
  setupTest(hooks);

  // Replace this with your real tests.
  test('it exists', function(assert) {
    let service = this.owner.lookup('service:overlays');
    assert.ok(service);
  });

  test('display states default to false', function(assert) {
    let service = this.owner.lookup('service:overlays');
    assert.equal(service.showLoading, false);
  });

  test('can set new values for display state', function(assert) {
    let service = this.owner.lookup('service:overlays');

    service.setOverlayState('showLoading', true);
    assert.equal(service.showLoading, true);
  });

  test('can reset all display state values to false', function(assert) {
    let service = this.owner.lookup('service:overlays');

    service.setOverlayState('showLoading', true);
    assert.equal(service.showLoading, true);

    service.reset();

    assert.equal(service.showLoading, false);
  });
});
