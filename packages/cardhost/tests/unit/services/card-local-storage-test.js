import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

module('Unit | Service | card-local-storage', function(hooks) {
  setupTest(hooks);

  hooks.beforeEach(async function() {
    this.owner.lookup('service:card-local-storage').clearDevice();
  });

  test('it exists', function(assert) {
    let service = this.owner.lookup('service:card-local-storage');
    assert.ok(service);
  });

  test('can add ids', function(assert) {
    let service = this.owner.lookup('service:card-local-storage');
    service.setDevice('abcdef');
    let id = service.getDevice();
    assert.equal(id, 'abcdef');
  });

  test('can clear ids', function(assert) {
    let service = this.owner.lookup('service:card-local-storage');
    service.setDevice('abcdef');
    service.clearDevice();
    let id = service.getDevice();
    assert.notOk(id);
  });
});
