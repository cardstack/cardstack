import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

module('Unit | Service | card-local-storage', function(hooks) {
  setupTest(hooks);

  hooks.beforeEach(async function() {
    this.owner.lookup('service:card-local-storage').clearIds();
  });

  test('it exists', function(assert) {
    let service = this.owner.lookup('service:card-local-storage');
    assert.ok(service);
  });

  test('can add ids', function(assert) {
    let service = this.owner.lookup('service:card-local-storage');
    service.addRecentCardId('local-hub::card-one');
    service.addRecentCardId('local-hub::card-two');
    let ids = service.getRecentCardIds();
    assert.equal(ids.length, 2);
    assert.ok(ids.includes('local-hub::card-one'));
    assert.ok(ids.includes('local-hub::card-two'));
  });

  test('can remove a single id', function(assert) {
    let service = this.owner.lookup('service:card-local-storage');
    service.addRecentCardId('local-hub::card-one');
    service.addRecentCardId('local-hub::card-two');
    service.removeRecentCardId('local-hub::card-one');
    let ids = service.getRecentCardIds();
    assert.equal(ids.length, 1);
    assert.ok(ids.includes('local-hub::card-two'));
  });

  test('can clear ids', function(assert) {
    let service = this.owner.lookup('service:card-local-storage');
    service.addRecentCardId('local-hub::card-one');
    service.addRecentCardId('local-hub::card-two');
    service.clearIds();
    let ids = service.getRecentCardIds();
    assert.equal(ids.length, 0);
  });
});
